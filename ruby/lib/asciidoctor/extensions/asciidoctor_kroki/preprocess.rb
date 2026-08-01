# frozen_string_literal: true

require 'pathname'
require 'uri'

module AsciidoctorExtensions
  # Resolves PlantUML `!include` directives (and friends) in diagram text before it is sent to
  # the Kroki server, mirroring the JavaScript/Node.js extension's preprocessor (src/preprocess.js)
  # so both language bindings behave the same way. See http://plantuml.com/en/preprocessing.
  #
  # Unlike the JS extension (which also supports Antora resource IDs and a pluggable virtual
  # filesystem), this Ruby port only needs to resolve plain local paths and http(s) URLs, since
  # the Ruby gem is not used with Antora.
  # rubocop:disable Metrics/ModuleLength
  module PlantUmlPreprocessor
    PLANTUML_BLOCK_RX = /@startuml\r?\n([\s\S]*?)\r?\n@enduml/.freeze
    INCLUDE_LINE_RX = /^\s*!(include(?:_many|_once|url|sub)?)\s+(.*)/.freeze

    class << self
      # @param diagram_text [String] the raw diagram source
      # @param resource_path [String, nil] absolute path (or URL) of the file the diagram text was
      #   read from, used to resolve relative !include directives; nil for a diagram written
      #   directly in the AsciiDoc source (resolved relative to the current working directory,
      #   like plain !include paths without a match in kroki-plantuml-include-paths)
      # @param include_paths [String, nil] the kroki-plantuml-include-paths attribute value
      #   (a list of directories separated by File::PATH_SEPARATOR)
      # @param logger [#info] logger used to report includes that were skipped, not raised
      # @return [String] the diagram text with !include directives resolved
      def preprocess(diagram_text, resource_path, include_paths, logger)
        resource = resource_path ? parse_resource(resource_path) : { dir: '', path: nil }
        paths = include_paths.to_s.empty? ? [] : include_paths.split(::File::PATH_SEPARATOR)
        diagram_text = preprocess_includes(diagram_text, resource, [], [], paths, logger)
        remove_tags(diagram_text)
      end

      private

      def preprocess_includes(diagram_text, resource, include_once, include_stack, include_paths, logger)
        inside_comment_block = false
        # -1 keeps trailing empty segments (a diagram ending in \n must not lose it), matching
        # JavaScript's String#split, which (unlike Ruby's default) never drops trailing empties.
        lines = diagram_text.split("\n", -1).map do |line|
          result = line
          if !inside_comment_block && (match = INCLUDE_LINE_RX.match(line))
            substituted = process_include_line(match, resource, include_once, include_stack, include_paths, logger)
            result = substituted unless substituted.nil?
          end
          inside_comment_block = true if line.include?("/'")
          inside_comment_block = false if inside_comment_block && line.include?("'/")
          result
        end
        lines.join("\n")
      end

      def process_include_line(match, resource, include_once, include_stack, include_paths, logger)
        include_directive = match[1].downcase
        target = parse_target(match[2])
        # Intentionally unlimited split (matches the JS split(!) semantics): a second '!' beyond
        # the sub name is silently discarded, same as upstream.
        url_sub = target[:url].split('!')
        trailing_content = target[:comment]
        url = url_sub[0].gsub('\\ ', ' ').sub(/\s+\z/, '')
        sub = url_sub[1]

        read_result = read_include(url, resource, include_paths, include_stack, logger)
        return nil if read_result[:skip]

        check_include_once(read_result[:file_path], include_once) if include_directive == 'include_once'

        text = extract_text(read_result[:text], include_directive, sub)
        include_stack.push(read_result[:file_path])
        text = preprocess_includes(text, parse_resource(read_result[:file_path]), include_once, include_stack, include_paths, logger)
        include_stack.pop

        trailing_content.empty? ? text : "#{text} #{trailing_content}"
      end

      def extract_text(text, include_directive, sub)
        return text_or_first_block(text) if sub.nil? || sub.empty?
        return text_from_sub(text, sub) if include_directive == 'includesub'

        index = /\A\d+\z/.match?(sub) ? sub.to_i : nil
        index ? text_from_index(text, index) : text_from_id(text, sub)
      end

      # Splits the rest of an !include line into the target path/URL and any trailing PlantUML
      # comment (# line comment or /' block comment), which must be preserved verbatim.
      def parse_target(value)
        (3...value.length).each do |i|
          char = value[i]
          return { url: value[0...(i - 1)].strip, comment: value[i..] } if char == '#' && value[i - 1] == ' ' && value[i - 2] != '\\'
          return { url: value[0...(i - 1)].strip, comment: value[(i - 1)..] } if char == "'" && value[i - 1] == '/' && value[i - 2] != '\\'
        end
        { url: value, comment: '' }
      end

      def read_include(url, resource, include_paths, include_stack, logger)
        if url.start_with?('<')
          # A standard library include cannot be resolved locally but might be resolved by the Kroki server.
          logger.info("Skipping preprocessing of PlantUML standard library include '#{url}'")
          return { skip: true, text: '', file_path: url }
        end
        raise "Preprocessing of PlantUML include failed, because recursive reading already included referenced file '#{url}'" if include_stack.include?(url)

        if remote_url?(url)
          read_and_rescue(url, url, 'remote', logger)
        else
          file_path = resolve_include_file(url, resource, include_paths)
          raise "Preprocessing of PlantUML include failed, because recursive reading already included referenced file '#{file_path}'" if include_stack.include?(file_path)

          read_and_rescue(file_path, file_path, 'local', logger)
        end
      end

      def read_and_rescue(path, file_path, kind, logger)
        { skip: false, text: read_resource(path), file_path: file_path }
      rescue StandardError => e
        # Includes a file that cannot be found but might be resolved by the Kroki server (see #60).
        logger.info("Skipping preprocessing of PlantUML include, because reading the referenced #{kind} file '#{file_path}' caused an error:\n#{e}")
        { skip: true, text: '', file_path: file_path }
      end

      def resolve_include_file(include_file, resource, include_paths)
        # When the including file was itself fetched from a remote URL, resolve a relative
        # include against that URL so it can be fetched remotely as well, instead of being
        # (incorrectly) looked up on the local file system.
        return ::URI.join(resource[:path], include_file).to_s if resource[:path].is_a?(::String) && remote_url?(resource[:path])

        ([resource[:dir]] + include_paths).each do |dir|
          candidate = join_paths(dir, include_file)
          return candidate if ::File.exist?(candidate)
        end
        include_file
      end

      def check_include_once(file_path, include_once)
        if include_once.include?(file_path)
          raise "Preprocessing of PlantUML include failed, because including multiple times referenced file '#{file_path}' with '!include_once' guard"
        end

        include_once.push(file_path)
      end

      def text_from_sub(text, sub)
        regex = /!startsub\s+#{::Regexp.escape(sub)}(?:\r\n|\n)([\s\S]*?)(?:\r\n|\n)!endsub/
        text.scan(regex).flatten.join("\n")
      end

      def text_from_id(text, id)
        regex = /@startuml\(id=#{::Regexp.escape(id)}\)(?:\r\n|\n)([\s\S]*?)(?:\r\n|\n)@enduml/
        text.scan(regex).flatten.join("\n")
      end

      def text_from_index(text, index)
        blocks = text.scan(PLANTUML_BLOCK_RX).flatten
        blocks[index] || ''
      end

      def text_or_first_block(text)
        match = PLANTUML_BLOCK_RX.match(text)
        match ? match[1] : text
      end

      # Removes all plantuml tags (@startuml/@enduml) from the diagram. It's possible to have more
      # than one diagram in a single file in the cli version of plantuml. This does not work for
      # the server, so recent plantuml versions remove the tags before processing the diagram. We
      # don't want to rely on the server to handle this, so we remove the tags here before sending
      # the diagram to the server.
      #
      # Some diagrams have special tags (i.e. @startmindmap for mindmap) - these are mandatory, so
      # we can't do much about them.
      def remove_tags(diagram_text)
        return diagram_text if diagram_text.nil? || diagram_text.empty?

        diagram_text.gsub(/^\s*@(?:startuml|enduml).*\n?/, '')
      end

      def remote_url?(str)
        str.start_with?('http://', 'https://')
      end

      def read_resource(path)
        if remote_url?(path)
          require 'open-uri'
          ::OpenURI.open_uri(path, &:read)
        else
          ::File.read(path, mode: 'rb:utf-8:utf-8')
        end
      end

      def parse_resource(file_path)
        if remote_url?(file_path)
          { dir: nil, path: file_path }
        else
          { dir: ::File.dirname(file_path), path: file_path }
        end
      end

      # Joins path segments the way Node's path.posix.join does: empty segments contribute
      # nothing (so a blank resource dir doesn't force everything into an absolute path), and the
      # result is lexically normalized (. and .. segments resolved) so that two different textual
      # routes to the same file compare equal for cycle detection.
      def join_paths(*parts)
        segments = parts.compact.map(&:to_s).reject(&:empty?)
        return '' if segments.empty?

        ::Pathname.new(segments.join('/')).cleanpath.to_s
      end
    end
  end
  # rubocop:enable Metrics/ModuleLength
end
