# frozen_string_literal: true

require 'rspec_helper'
require 'socket'
require 'asciidoctor'
require_relative '../lib/asciidoctor/extensions/asciidoctor_kroki'

describe AsciidoctorExtensions::HttpError do
  describe '.server_message_of' do
    it 'should extract the message of a Kroki JSON error' do
      body = '{"error":{"code":400,"message":"Unsupported output format"}}'
      (expect described_class.server_message_of(body, 'application/json')).to eq 'Unsupported output format'
    end
    it 'should return the stripped body when it is not JSON' do
      (expect described_class.server_message_of("Error 400: Syntax Error?\n", 'text/plain')).to eq 'Error 400: Syntax Error?'
    end
    it 'should return the body of an invalid or unexpected JSON response' do
      (expect described_class.server_message_of('{"message":"nope"}', 'application/json')).to eq '{"message":"nope"}'
      (expect described_class.server_message_of('["nope"]', 'application/json')).to eq '["nope"]'
      (expect described_class.server_message_of('<html>', 'application/json; charset=utf-8')).to eq '<html>'
    end
    it 'should return nil for an empty body' do
      (expect described_class.server_message_of('  ', 'text/plain')).to be_nil
      (expect described_class.server_message_of(nil, nil)).to be_nil
    end
  end

  describe '#with_url' do
    it 'should keep the fields of the error' do
      error = described_class.new('http', 'GET', 'http://localhost:8000/plantuml/svg/encoded', 'server returns 400 status code; response: Syntax Error?',
                                  status: 400, server_message: 'Syntax Error?')
      copy = error.with_url('http://localhost:8000/plantuml/svg')
      (expect copy.message).to eq 'GET http://localhost:8000/plantuml/svg - server returns 400 status code; response: Syntax Error?'
      (expect copy.type).to eq 'http'
      (expect copy.url).to eq 'http://localhost:8000/plantuml/svg'
      (expect copy.status).to eq 400
      (expect copy.server_message).to eq 'Syntax Error?'
    end
  end

  context 'when raised by the Kroki HTTP client' do
    # Serves a raw HTTP response, and optionally stalls before closing the connection.
    # The headers of the request are pushed to `requests`.
    def with_server(response, requests: [], stall: false)
      server = TCPServer.new('127.0.0.1', 0)
      thread = Thread.new do
        client = server.accept
        headers = []
        while (line = client.gets) && line != "\r\n"
          headers << line.chomp
        end
        requests << headers
        client.write(response)
        sleep 5 if stall
        client.close
      end
      yield "http://127.0.0.1:#{server.addr[1]}"
    ensure
      thread&.kill
      server&.close
    end

    let(:client) { AsciidoctorExtensions::KrokiHttpClient }

    def expect_http_error(**fields, &block)
      expect(&block).to(raise_error(described_class) do |error|
        fields.each { |name, value| (expect error.public_send(name)).to eq(value), "#{name}: #{error.message}" }
      end)
    end

    it 'should use the message of a JSON error returned by Kroki as the server message' do
      body = '{"error":{"code":400,"message":"Syntax Error? (Assumed diagram type: sequence) (line: 2)"}}'
      response = "HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\nContent-Length: #{body.bytesize}\r\n\r\n#{body}"
      with_server(response) do |url|
        expect_http_error(type: 'http', http_method: 'POST', url: "#{url}/plantuml/png", status: 400,
                          server_message: 'Syntax Error? (Assumed diagram type: sequence) (line: 2)',
                          message: "POST #{url}/plantuml/png - server returns 400 status code; response: Syntax Error? (Assumed diagram type: sequence) (line: 2)") do
          client.post("#{url}/plantuml/png", 'x', {}, 'binary')
        end
      end
    end
    it 'should accept application/json, so that the server returns an error as JSON' do
      requests = []
      with_server("HTTP/1.1 200 OK\r\nContent-Length: 2\r\nContent-Type: text/plain\r\n\r\nok", requests: requests) do |url|
        client.get("#{url}/plantuml/txt/encoded", {}, 'utf8', 'text/plain')
      end
      with_server("HTTP/1.1 200 OK\r\nContent-Length: 2\r\nContent-Type: text/plain\r\n\r\nok", requests: requests) do |url|
        client.post("#{url}/plantuml/txt", 'alice -> bob', {}, 'utf8', 'text/plain')
      end
      (expect requests.size).to eq 2
      requests.each { |headers| (expect headers.map(&:downcase)).to include 'accept: application/json' }
    end
    it 'should have the http type and the status on HTTP 414' do
      with_server("HTTP/1.1 414 URI Too Long\r\nContent-Length: 0\r\n\r\n") do |url|
        expect_http_error(type: 'http', status: 414, server_message: nil) { client.get("#{url}/a", {}, 'utf8') }
      end
    end
    it 'should have the unexpected-response type on an empty response' do
      with_server("HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n") do |url|
        expect_http_error(type: 'unexpected-response', status: 200) { client.get("#{url}/a", {}, 'utf8') }
      end
    end
    it 'should have the unexpected-response type on an unexpected content type' do
      with_server("HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: 6\r\n\r\n<html>") do |url|
        expect_http_error(type: 'unexpected-response', status: 200) { client.get("#{url}/a", {}, 'utf8', 'image/svg+xml') }
      end
    end
    it 'should have the network type when the server cannot be reached' do
      server = TCPServer.new('127.0.0.1', 0)
      port = server.addr[1]
      server.close
      expect_http_error(type: 'network', http_method: 'GET', url: "http://127.0.0.1:#{port}/a", status: nil) do
        client.get("http://127.0.0.1:#{port}/a", {}, 'utf8')
      end
    end
    it 'should have the timeout type when the response is not received in time' do
      stub_const('AsciidoctorExtensions::KrokiHttpLimits::TIMEOUT', 0.2)
      with_server("HTTP/1.1 200 OK\r\nContent-Length: 100\r\n\r\nxx", stall: true) do |url|
        expect_http_error(type: 'timeout') { client.get("#{url}/a", {}, 'utf8') }
      end
    end
    it 'should have the size-limit type when the response is too large' do
      stub_const('AsciidoctorExtensions::KrokiHttpLimits::MAX_RESPONSE_SIZE', 10)
      with_server("HTTP/1.1 200 OK\r\nContent-Length: 100\r\n\r\n") do |url|
        expect_http_error(type: 'size-limit') { client.get("#{url}/a", {}, 'utf8') }
      end
    end
  end

  context 'when raised by the Kroki client for a GET request' do
    it 'should keep the fields of the error and identify the request without the encoded diagram' do
      kroki_http_client = Class.new do
        class << self
          def get(uri, _, _, _)
            raise AsciidoctorExtensions::HttpError.new('http', 'GET', uri, 'server returns 400 status code; response: Syntax Error?',
                                                       status: 400, server_message: 'Syntax Error?')
          end
        end
      end
      kroki_diagram = AsciidoctorExtensions::KrokiDiagram.new('plantuml', 'svg', 'alice -> bob')
      kroki_client = AsciidoctorExtensions::KrokiClient.new(server_url: 'http://localhost:8000', http_method: 'get', http_client: kroki_http_client)
      (expect { kroki_client.get_image(kroki_diagram, 'utf8') }).to(raise_error(described_class) do |error|
        (expect error.message).to eq 'GET http://localhost:8000/plantuml/svg - server returns 400 status code; response: Syntax Error?'
        (expect error.url).to eq 'http://localhost:8000/plantuml/svg'
        (expect error.type).to eq 'http'
        (expect error.status).to eq 400
        (expect error.server_message).to eq 'Syntax Error?'
      end)
    end
  end
end
