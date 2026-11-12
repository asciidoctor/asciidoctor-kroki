# frozen_string_literal: true

require 'json'

module AsciidoctorExtensions
  # Error raised when an HTTP request fails, for instance a request to the Kroki server, the same
  # way as src/http-error.js in the JavaScript/Node.js extension.
  # The message has the form "<method> <url> - <reason>".
  class HttpError < StandardError
    # Why the request failed:
    # - network: the server couldn't be reached (connection refused, unknown host, TLS error...);
    # - timeout: the complete response wasn't received in time;
    # - http: the server answered with a non-2xx status;
    # - unexpected-response: the server answered with a 2xx status, but an unexpected content type or an empty body;
    # - size-limit: the response exceeds the maximum size.
    TYPES = %w[network timeout http unexpected-response size-limit].freeze

    attr_reader :type, :http_method, :url, :reason, :status, :server_message

    # @param type [String] why the request failed, one of TYPES
    # @param http_method [String] HTTP method of the request
    # @param url [String] URL identifying the request (for a Kroki GET request, without the encoded diagram)
    # @param reason [String] description of the failure, without the method and the URL
    # @param status [Integer, nil] HTTP status of the response, when there is one
    # @param server_message [String, nil] reason returned by the server, when there is one
    def initialize(type, http_method, url, reason, status: nil, server_message: nil)
      super("#{http_method} #{url} - #{reason}")
      @type = type
      @http_method = http_method
      @url = url
      @reason = reason
      @status = status
      @server_message = server_message
    end

    # Returns a copy of this error that identifies the request by another URL.
    def with_url(url)
      copy = HttpError.new(@type, @http_method, url, @reason, status: @status, server_message: @server_message)
      copy.set_backtrace(backtrace) if backtrace
      copy
    end

    # Returns the reason contained in the body of an error response.
    # The Kroki server answers {"error": {"code": 400, "message": "..."}} when the request accepts
    # application/json; any other body (an older server, a proxy) is returned as is.
    #
    # @return [String, nil] the reason, or nil when the body is empty
    def self.server_message_of(body, content_type)
      body = body.to_s
      if content_type.to_s.downcase.start_with?('application/json')
        begin
          message = JSON.parse(body).dig('error', 'message')
          return message if message.is_a?(String) && !message.empty?
        rescue JSON::ParserError, TypeError, NoMethodError
          # not the JSON returned by Kroki, fall back to the raw body
        end
      end
      body = body.dup.force_encoding(Encoding::UTF_8).scrub.strip
      body.empty? ? nil : body
    end
  end
end
