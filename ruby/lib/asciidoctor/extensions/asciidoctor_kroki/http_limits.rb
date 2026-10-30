# frozen_string_literal: true

require 'timeout'

module AsciidoctorExtensions
  # Limits of the HTTP requests sent to Kroki and of the remote resources read by the extension,
  # the same way as src/http-client.js in the JavaScript/Node.js extension.
  module KrokiHttpLimits
    # Maximum time in seconds for a request, including the time needed to receive the complete response body.
    TIMEOUT = 60
    # Maximum size in bytes of a response body.
    MAX_RESPONSE_SIZE = 25 * 1024 * 1024

    class TimedOut < StandardError; end
    private_constant :TimedOut

    class << self
      def with_timeout(method, uri, &)
        ::Timeout.timeout(self::TIMEOUT, TimedOut, &)
      rescue TimedOut
        raise "#{method} #{uri} - timed out after #{self::TIMEOUT}s"
      end

      def check_size(size, method, uri)
        raise "#{method} #{uri} - response exceeds maximum size of #{self::MAX_RESPONSE_SIZE} bytes" if size > self::MAX_RESPONSE_SIZE
      end

      def read_uri(uri)
        require 'open-uri'
        with_timeout('GET', uri) do
          check = ->(size) { check_size(size.to_i, 'GET', uri) }
          ::OpenURI.open_uri(uri, { content_length_proc: check, progress_proc: check }, &:read)
        end
      end
    end
  end
end
