# frozen_string_literal: true

require 'digest'
require 'fileutils'
require 'json'

module AsciidoctorExtensions
  # Persistent, content-addressed cache for fetched diagrams, independent of the output
  # directory. Ports src/cache.js so both language bindings behave the same way: the cache
  # key is derived from the diagram request itself (server URL, type, format, encoded source,
  # options), not from the output file name, so it also survives builds that wipe the output
  # directory between runs (e.g. Antora) and correctly detects unchanged content for diagrams
  # with a stable, user-defined name (see #90, #113).
  module Cache
    VALID_CACHE_MODES = ['', 'true', 'false', 'refresh'].freeze

    class << self
      # Resolves the persistent cache directory.
      # Uses the `kroki-cache-dir` attribute when set; otherwise defaults to the XDG cache
      # directory (`$XDG_CACHE_HOME/kroki` or `~/.cache/kroki`).
      def resolve_cache_dir(doc)
        configured = doc.attr('kroki-cache-dir')
        return configured if configured && !configured.empty?

        xdg_cache_home = ENV['XDG_CACHE_HOME'] || File.join(Dir.home, '.cache')
        File.join(xdg_cache_home, 'kroki')
      end

      # Resolves the `kroki-cache` attribute into a cache mode.
      #
      # Recognised values are: unset (defaults to enabled), `` (set with no value, e.g.
      # `:kroki-cache:`) and `true` (both enabled), `false` (disabled), and `refresh` (enabled,
      # but bypasses cached reads and re-fetches + updates the cache). Any other value is
      # invalid: it is logged and treated as if unset.
      #
      # @return [Hash{Symbol => Boolean}] with keys :enabled and :refresh
      def resolve_cache_mode(doc, logger)
        raw = doc.attr('kroki-cache')
        return { enabled: true, refresh: false } if raw.nil?

        value = raw.to_s.strip.downcase
        unless VALID_CACHE_MODES.include?(value)
          logger.warn "Invalid value '#{raw}' for kroki-cache attribute. The value must be either: " \
                      "'true', 'false' or 'refresh'. Proceeding using: 'true'."
          return { enabled: true, refresh: false }
        end
        { enabled: value != 'false', refresh: value == 'refresh' }
      end

      # Computes the content-addressed cache key for a diagram.
      #
      # Deliberately host-dependent: the server URL is part of the key because two Kroki
      # servers are not guaranteed to render the same source identically (they may run
      # different versions of the underlying diagram libraries). Options are sorted so the
      # key does not depend on their insertion order.
      def content_key(kroki_diagram, server_url)
        sorted_opts = kroki_diagram.opts.sort_by { |k, _| k.to_s }
        material = [server_url, kroki_diagram.type, kroki_diagram.format, kroki_diagram.encode, sorted_opts.to_json].join('/')
        Digest::SHA256.hexdigest(material)
      end

      # Whether a diagram is already present in the cache.
      def exists_in_cache?(cache_dir, key, format)
        File.exist?(cache_file_path(cache_dir, key, format))
      end

      # Reads a cached diagram.
      def read_from_cache(cache_dir, key, format)
        File.read(cache_file_path(cache_dir, key, format), mode: 'rb')
      end

      # Writes a diagram to the cache, creating the cache directory if needed.
      def write_to_cache(cache_dir, key, format, contents)
        FileUtils.mkdir_p(cache_dir)
        File.write(cache_file_path(cache_dir, key, format), contents, mode: 'wb')
      end

      private

      def cache_file_path(cache_dir, key, format)
        File.join(cache_dir, "#{key}.#{format}")
      end
    end
  end
end
