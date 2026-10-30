# frozen_string_literal: true

module AsciidoctorExtensions
  # Checks the paths used by the extension against the safe mode, the same way as
  # src/read-policy.js in the JavaScript/Node.js extension.
  module KrokiPathPolicy
    class << self
      # A lexical check, like Asciidoctor
      def inside?(path, dir)
        resolved = normalize(path)
        dir = normalize(dir)
        resolved == dir || resolved.start_with?(dir.end_with?('/') ? dir : "#{dir}/")
      end

      # Checks the directory of the generated images when the safe mode is `safe` or higher. A
      # value set from the API or the CLI is locked, so it cannot come from the document.
      def images_dir_allowed?(doc, dir)
        return true if doc.safe < ::Asciidoctor::SafeMode::SAFE

        locked = if doc.attr('imagesoutdir')
                   doc.attribute_locked?('imagesoutdir')
                 else
                   doc.attribute_locked?('imagesdir') && (!doc.attr('outdir') || doc.attribute_locked?('outdir'))
                 end
        locked || inside_write_root?(doc, dir)
      end

      # Checks the kroki-cache-dir attribute when the safe mode is `safe` or higher.
      def cache_dir_allowed?(doc, dir)
        doc.safe < ::Asciidoctor::SafeMode::SAFE || doc.attribute_locked?('kroki-cache-dir') || inside_write_root?(doc, dir)
      end

      private

      # The base directory, and the output directory given to the converter.
      def inside_write_root?(doc, dir)
        roots = [doc.base_dir, (doc.nested? ? doc.parent_document : doc).options[:to_dir]]
        roots << doc.attr('outdir') if doc.attribute_locked?('outdir')
        roots.compact.any? { |root| inside?(dir, root) }
      end

      # The case of the drive letter varies on Windows.
      def normalize(path)
        expanded = ::File.expand_path(path)
        ::File::ALT_SEPARATOR ? expanded.downcase : expanded
      end
    end
  end
end
