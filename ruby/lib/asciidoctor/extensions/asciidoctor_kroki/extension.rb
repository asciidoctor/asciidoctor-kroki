# frozen_string_literal: true

require 'cgi'
require 'asciidoctor/extensions' unless RUBY_ENGINE == 'opal'

# Asciidoctor extensions
#
module AsciidoctorExtensions
  include Asciidoctor

  # A block extension that converts a diagram into an image.
  #
  class KrokiBlockProcessor < Extensions::BlockProcessor
    use_dsl

    on_context :listing, :literal
    name_positional_attributes 'target', 'format'

    # @param name [String] name of the block macro (optional)
    # @param config [Hash] a config hash (optional)
    #   - :logger a logger used to log warning and errors (optional)
    #
    def initialize(name = nil, config = {})
      @logger = (config || {}).delete(:logger) { ::Asciidoctor::LoggerManager.logger }
      super
    end

    def process(parent, reader, attrs)
      diagram_type = @name
      diagram_text = reader.string
      KrokiProcessor.process(self, parent, attrs, diagram_type, diagram_text, @logger)
    end

    protected

    attr_reader :logger
  end

  # A block macro extension that converts a diagram into an image.
  #
  class KrokiBlockMacroProcessor < Asciidoctor::Extensions::BlockMacroProcessor
    include Asciidoctor::Logging
    use_dsl

    name_positional_attributes 'format'

    # @param name [String] name of the block macro (optional)
    # @param config [Hash] a config hash (optional)
    #   - :logger a logger used to log warning and errors (optional)
    #
    def initialize(name = nil, config = {})
      @logger = (config || {}).delete(:logger) { ::Asciidoctor::LoggerManager.logger }
      super
    end

    # Processes the diagram block or block macro by converting it into an image or literal block.
    #
    # @param parent [Asciidoctor::AbstractBlock] the parent asciidoc block of the block or block macro being processed
    # @param target [String] the target value of a block macro
    # @param attrs [Hash] the attributes of the block or block macro
    # @return [Asciidoctor::AbstractBlock] a new block that replaces the original block or block macro
    def process(parent, target, attrs)
      diagram_type = @name
      target = parent.apply_subs(target, [:attributes])

      unless read_allowed?(target)
        link = create_inline(parent, :anchor, target, type: :link, target: target)
        return create_block(parent, :paragraph, link.convert, {}, content_model: :raw)
      end

      unless (path = resolve_target_path(parent, target))
        logger.error message_with_context "#{diagram_type} block macro not found: #{target}.", source_location: parent.document.reader.cursor_at_mark
        return create_block(parent, 'paragraph', unresolved_block_macro_message(diagram_type, target), {})
      end

      begin
        diagram_text = read(path)
      rescue => e # rubocop:disable Style/RescueStandardError
        logger.error message_with_context "Failed to read #{diagram_type} file: #{path}. #{e}.", source_location: parent.document.reader.cursor_at_mark
        return create_block(parent, 'paragraph', unresolved_block_macro_message(diagram_type, path), {})
      end
      KrokiProcessor.process(self, parent, attrs, diagram_type, diagram_text, @logger)
    end

    protected

    attr_reader :logger

    # @param parent [Asciidoctor::AbstractBlock] the parent asciidoc block of the block or block macro being processed
    # @param target [String] the target value of a block macro
    def resolve_target_path(parent, target)
      parent.normalize_system_path(target)
    end

    def read_allowed?(_target)
      true
    end

    def read(target)
      if target.start_with?('http://') || target.start_with?('https://')
        require 'open-uri'
        ::OpenURI.open_uri(target, &:read)
      else
        File.read(target, mode: 'rb:utf-8:utf-8')
      end
    end

    def unresolved_block_macro_message(name, target)
      "Unresolved block macro - #{name}::#{target}[]"
    end
  end

  # Kroki API
  #
  module Kroki
    SUPPORTED_DIAGRAM_NAMES = %w[
      actdiag
      blockdiag
      bpmn
      bytefield
      c4plantuml
      d2
      dbml
      ditaa
      erd
      excalidraw
      graphviz
      mermaid
      nomnoml
      nwdiag
      packetdiag
      pikchr
      plantuml
      rackdiag
      seqdiag
      svgbob
      symbolator
      tikz
      umlet
      vega
      vegalite
      wavedrom
      structurizr
      diagramsnet
      wireviz
    ].freeze
  end

  # Internal processor
  #
  class KrokiProcessor
    include Asciidoctor::Logging

    TEXT_FORMATS = %w[txt atxt utxt].freeze
    BUILTIN_ATTRIBUTES = %w[target width height format fallback link float align role caption title cloaked-context subs].freeze

    class << self
      # rubocop:disable Metrics/AbcSize
      def process(processor, parent, attrs, diagram_type, diagram_text, logger)
        doc = parent.document
        diagram_text = prepend_plantuml_config(diagram_text, diagram_type, doc, logger)
        # If "subs" attribute is specified, substitute accordingly.
        # Be careful not to specify "specialcharacters" or your diagram code won't be valid anymore!
        if (subs = attrs['subs'])
          diagram_text = parent.apply_subs(diagram_text, parent.resolve_subs(subs))
        end
        attrs.delete('opts')
        format = get_format(doc, attrs, diagram_type)
        attrs['role'] = get_role(format, attrs['role'])
        attrs['format'] = format
        opts = attrs.filter { |key, _| key.is_a?(String) && BUILTIN_ATTRIBUTES.none? { |k| key == k } && !key.end_with?('-option') }
        kroki_diagram = KrokiDiagram.new(diagram_type, format, diagram_text, attrs['target'], opts)
        kroki_client = KrokiClient.new({
                                         server_url: server_url(doc),
                                         http_method: http_method(doc),
                                         max_uri_length: max_uri_length(doc),
                                         source_location: doc.reader.cursor_at_mark,
                                         http_client: KrokiHttpClient
                                       }, logger)
        alt = get_alt(attrs)
        title = attrs.delete('title')
        caption = attrs.delete('caption')
        if TEXT_FORMATS.include?(format)
          text_content = kroki_client.text_content(kroki_diagram)
          block = processor.create_block(parent, 'literal', text_content, attrs)
        else
          attrs['alt'] = alt
          attrs['target'] = create_image_src(doc, kroki_diagram, kroki_client)
          block = processor.create_image_block(parent, attrs)
        end
        block.title = title if title
        block.assign_caption(caption, 'figure')
        block
      end
      # rubocop:enable Metrics/AbcSize

      private

      def prepend_plantuml_config(diagram_text, diagram_type, doc, logger)
        if diagram_type == :plantuml && doc.safe < ::Asciidoctor::SafeMode::SECURE && doc.attr?('kroki-plantuml-include')
          # REMIND: this behaves different than the JS version
          # Once we have a preprocessor for Ruby, the value should be added in the diagram source as "!include #{plantuml_include}"
          plantuml_include_path = doc.normalize_system_path(doc.attr('kroki-plantuml-include'))
          if ::File.readable? plantuml_include_path
            config = File.read(plantuml_include_path)
            diagram_text = "#{config}\n#{diagram_text}"
          else
            logger.warn message_with_context "Unable to read plantuml-include. File not found or not readable: #{plantuml_include_path}.",
                                             source_location: doc.reader.cursor_at_mark
          end
        end
        diagram_text
      end

      def get_alt(attrs)
        if (title = attrs['title'])
          title
        elsif (target = attrs['target'])
          target
        else
          'Diagram'
        end
      end

      def get_role(format, role)
        if role
          if format
            "#{role} kroki-format-#{format} kroki"
          else
            "#{role} kroki"
          end
        else
          'kroki'
        end
      end

      def get_format(doc, attrs, diagram_type)
        format = attrs['format'] || doc.attr('kroki-default-format') || 'svg'
        if format == 'png'
          # redirect PNG format to SVG if the diagram library only supports SVG as output format.
          # this is useful when the default format has been set to PNG
          # Currently, nomnoml, svgbob, wavedrom only support SVG as output format.
          svg_only_diagram_types = %i[nomnoml svgbob wavedrom]
          format = 'svg' if svg_only_diagram_types.include?(diagram_type)
        end
        format
      end

      def create_image_src(doc, kroki_diagram, kroki_client)
        if doc.attr('kroki-fetch-diagram') && doc.safe < ::Asciidoctor::SafeMode::SECURE
          kroki_diagram.save(output_dir_path(doc), kroki_client)
        else
          kroki_diagram.get_diagram_uri(server_url(doc))
        end
      end

      def server_url(doc)
        doc.attr('kroki-server-url', 'https://kroki.io')
      end

      def http_method(doc)
        doc.attr('kroki-http-method', 'adaptive').downcase
      end

      def max_uri_length(doc)
        doc.attr('kroki-max-uri-length', '4000').to_i
      end

      def output_dir_path(doc)
        images_dir = doc.attr('imagesdir', '')
        if (images_output_dir = doc.attr('imagesoutdir'))
          images_output_dir
        # the nested document logic will become obsolete once https://github.com/asciidoctor/asciidoctor/commit/7edc9da023522be67b17e2a085d72e056703a438 is released
        elsif (out_dir = doc.attr('outdir') || (doc.nested? ? doc.parent_document : doc).options[:to_dir])
          File.join(out_dir, images_dir)
        else
          File.join(doc.base_dir, images_dir)
        end
      end
    end
  end

  # Kroki diagram
  #
  class KrokiDiagram
    require 'fileutils'
    require 'zlib'
    require 'digest'

    attr_reader :type, :text, :format, :target, :opts

    def initialize(type, format, text, target = nil, opts = {})
      @text = text
      @type = type
      @format = format
      @target = target
      @opts = opts
    end

    def get_diagram_uri(server_url)
      query_params = opts.map { |k, v| "#{k}=#{_url_encode(v.to_s)}" }.join('&') unless opts.empty?
      _join_uri_segments(server_url, @type, @format, encode) + (query_params ? "?#{query_params}" : '')
    end

    def encode
      ([Zlib::Deflate.deflate(@text, 9)].pack 'm0').tr '+/', '-_'
    end

    def save(output_dir_path, kroki_client)
      diagram_url = get_diagram_uri(kroki_client.server_url)
      diagram_name = "#{@target || 'diag'}-#{Digest::SHA256.hexdigest diagram_url}.#{@format}"
      file_path = File.join(output_dir_path, diagram_name)
      encoding = case @format
                 when 'txt', 'atxt', 'utxt', 'svg'
                   'utf8'
                 else
                   'binary'
                 end
      # file is either (already) on the file system or we should read it from Kroki
      unless File.exist?(file_path)
        contents = kroki_client.get_image(self, encoding)
        FileUtils.mkdir_p(output_dir_path)
        File.write(file_path, contents, mode: 'wb')
      end

      diagram_name
    end

    private

    def _url_encode(text)
      CGI.escape(text).gsub('+', '%20')
    end

    def _join_uri_segments(base, *uris)
      segments = []
      # remove trailing slashes
      segments.push(base.gsub(%r{/+$}, ''))
      segments.concat(uris.map do |uri|
        # remove leading and trailing slashes
        uri.to_s
          .gsub(%r{^/+}, '')
          .gsub(%r{/+$}, '')
      end)
      segments.join('/')
    end
  end

  # Kroki client
  #
  class KrokiClient
    include Asciidoctor::Logging

    attr_reader :server_url, :method, :max_uri_length

    SUPPORTED_HTTP_METHODS = %w[get post adaptive].freeze

    def initialize(opts, logger = ::Asciidoctor::LoggerManager.logger)
      @server_url = opts[:server_url]
      @max_uri_length = opts.fetch(:max_uri_length, 4000)
      @http_client = opts[:http_client]
      method = opts.fetch(:http_method, 'adaptive').downcase
      if SUPPORTED_HTTP_METHODS.include?(method)
        @method = method
      else
        logger.warn message_with_context "Invalid value '#{method}' for kroki-http-method attribute. The value must be either: " \
                                         "'get', 'post' or 'adaptive'. Proceeding using: 'adaptive'.",
                                         source_location: opts[:source_location]
        @method = 'adaptive'
      end
    end

    def text_content(kroki_diagram)
      get_image(kroki_diagram, 'utf-8')
    end

    def get_image(kroki_diagram, encoding)
      type = kroki_diagram.type
      format = kroki_diagram.format
      text = kroki_diagram.text
      opts = kroki_diagram.opts
      if @method == 'adaptive' || @method == 'get'
        uri = kroki_diagram.get_diagram_uri(server_url)
        if uri.length > @max_uri_length
          # The request URI is longer than the max URI length.
          if @method == 'get'
            # The request might be rejected by the server with a 414 Request-URI Too Large.
            # Consider using the attribute kroki-http-method with the value 'adaptive'.
            @http_client.get(uri, opts, encoding)
          else
            @http_client.post("#{@server_url}/#{type}/#{format}", text, opts, encoding)
          end
        else
          @http_client.get(uri, opts, encoding)
        end
      else
        @http_client.post("#{@server_url}/#{type}/#{format}", text, opts, encoding)
      end
    end
  end

  # Kroki HTTP client
  #
  class KrokiHttpClient
    require 'net/http'
    require 'uri'
    require 'json'

    class << self
      REFERER = "asciidoctor/kroki.rb/#{Asciidoctor::AsciidoctorKroki::VERSION}"

      def get(uri, opts, _)
        uri = URI(uri)
        headers = opts.transform_keys { |key| "Kroki-Diagram-Options-#{key}" }
                      .merge({ 'referer' => REFERER })
        request = ::Net::HTTP::Get.new(uri, headers)
        ::Net::HTTP.start(
          uri.hostname,
          uri.port,
          use_ssl: (uri.scheme == 'https')
        ) do |http|
          http.request(request).body
        end
      end

      def post(uri, data, opts, _)
        headers = opts.transform_keys { |key| "Kroki-Diagram-Options-#{key}" }
                      .merge({
                               'Content-Type' => 'text/plain',
                               'referer' => REFERER
                             })
        res = ::Net::HTTP.post(
          URI(uri),
          data,
          headers
        )
        res.body
      end
    end
  end
end
