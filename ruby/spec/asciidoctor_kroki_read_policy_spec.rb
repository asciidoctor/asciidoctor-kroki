# frozen_string_literal: true

require 'rspec_helper'
require 'asciidoctor'
require 'tmpdir'
require 'socket'
require 'zlib'
require_relative '../lib/asciidoctor/extensions/asciidoctor_kroki'

describe 'Read and write policy' do
  around do |example|
    Dir.mktmpdir('kroki-base-') do |base_dir|
      Dir.mktmpdir('kroki-outside-') do |outside_dir|
        @base_dir = base_dir
        @secret_file = File.join(outside_dir, 'secret.txt')
        File.write(@secret_file, 'TOP-SECRET')
        File.write(File.join(base_dir, 'inside.puml'), 'skinparam inside true')
        Dir.mkdir(File.join(base_dir, 'sub'))
        example.run
      end
    end
  end

  def convert(input, safe: :safe, attributes: {})
    logger = Asciidoctor::MemoryLogger.new
    previous = Asciidoctor::LoggerManager.logger
    Asciidoctor::LoggerManager.logger = logger
    html = Asciidoctor.convert(input, standalone: false, safe: safe, base_dir: @base_dir, attributes: attributes)
    [html, logger.messages.map { |message| message[:message].is_a?(Hash) ? message[:message][:text] : message[:message] }]
  ensure
    Asciidoctor::LoggerManager.logger = previous
  end

  def diagram_source(html)
    encoded = html[%r{src="[^"]*/(?:plantuml|vegalite|structurizr)/\w+/([\w=-]+)"}, 1]
    Zlib::Inflate.inflate(encoded.tr('-_', '+/').unpack1('m'))
  end

  def block(type, body)
    "[#{type}]\n....\n#{body}\n....\n"
  end

  %i[safe server].each do |safe|
    context "in #{safe} mode" do
      it 'should not read a !include outside of the base directory' do
        html, logs = convert(block('plantuml', "!include #{@secret_file}\nalice"), safe: safe)
        (expect diagram_source(html)).to eq "!include #{@secret_file}\nalice"
        (expect logs.join).to include('outside of the base directory')
      end
      it 'should not read a !include URL without allow-uri-read' do
        expect(OpenURI).not_to receive(:open_uri)
        html, logs = convert(block('plantuml', "!include https://domain.org/a.puml\nalice"), safe: safe)
        (expect diagram_source(html)).to eq "!include https://domain.org/a.puml\nalice"
        (expect logs.join).to include('allow-uri-read')
      end
    end
  end

  it 'should read a !include inside of the base directory' do
    html, = convert(block('plantuml', "!include #{File.join(@base_dir, 'inside.puml')}\nalice"))
    (expect diagram_source(html)).to include('skinparam inside true')
  end
  it 'should read a !include outside of the base directory in unsafe mode' do
    html, = convert(block('plantuml', "!include #{@secret_file}\nalice"), safe: :unsafe)
    (expect diagram_source(html)).to include('TOP-SECRET')
  end
  it 'should read a !include URL with allow-uri-read' do
    allow(OpenURI).to receive(:open_uri).and_return('REMOTE-CONTENT')
    html, = convert(block('plantuml', "!include https://domain.org/a.puml\nalice"), attributes: { 'allow-uri-read' => '' })
    (expect diagram_source(html)).to include('REMOTE-CONTENT')
  end
  it 'should not read a remote block macro target in secure mode, even with allow-uri-read' do
    expect(OpenURI).not_to receive(:open_uri)
    html, = convert("plantuml::https://domain.org/a.puml[]\n", safe: :secure, attributes: { 'allow-uri-read' => '' })
    (expect html).to include('<a href="https://domain.org/a.puml"')
  end

  context 'with kroki-plantuml-include' do
    it 'should warn and ignore a missing file' do
      html, logs = convert(block('plantuml', 'alice'), attributes: { 'kroki-plantuml-include' => 'missing.puml' })
      (expect diagram_source(html)).to eq 'alice'
      (expect logs.join).to include('Unable to read plantuml-include')
    end
    it 'should warn and ignore a directory' do
      html, logs = convert(block('plantuml', 'alice'), attributes: { 'kroki-plantuml-include' => 'sub' })
      (expect diagram_source(html)).to eq 'alice'
      (expect logs.join).to include('Unable to read plantuml-include')
    end
  end

  context 'with kroki-fetch-diagram' do
    before { allow_any_instance_of(AsciidoctorExtensions::KrokiClient).to receive(:get_image).and_return('<svg/>') }

    def fetch_attributes
      { 'kroki-fetch-diagram' => '', 'kroki-cache' => 'false', 'imagesoutdir' => File.join(@base_dir, 'images') }
    end

    %i[safe server].each do |safe|
      it "should not write outside of the output directory in #{safe} mode" do
        name = "#{File.basename(@base_dir)}-escaped"
        html, logs = convert("[plantuml,../../#{name}]\n....\nalice\n....\n", safe: safe, attributes: fetch_attributes)
        (expect File.exist?(File.join(@base_dir, '..', "#{name}.svg"))).to be false
        (expect html).to match(/src="[^"]*diag-\h+\.svg"/)
        (expect logs.join).to include('outside of the output directory')
      end
    end
    it 'should reject a format that contains a path separator' do
      html, = convert("[plantuml,name,../../evil]\n....\nalice\n....\n", attributes: fetch_attributes)
      (expect html).to include('kroki-error')
    end
    it 'should keep a plain diagram name' do
      html, = convert("[plantuml,plain]\n....\nalice\n....\n", attributes: fetch_attributes)
      (expect html).to include('plain.svg"')
      (expect File.exist?(File.join(@base_dir, 'images', 'plain.svg'))).to be true
    end
  end

  context 'with a block macro that cannot be read' do
    it 'should render a kroki-error paragraph with the title and the role, and without the absolute path' do
      html, logs = convert(".A title\nplantuml::missing.puml[role=sequence]\n")
      (expect html).to include('class="paragraph sequence kroki-error"')
      (expect html).to include('A title')
      (expect html).to include('Unresolved block macro - plantuml::missing.puml[]')
      (expect html).not_to include(@base_dir)
      (expect logs.join).to include('Skipping plantuml block')
    end
  end

  it 'should only add the kroki class if the role is empty' do
    html, = convert("[plantuml,role=]\n....\nalice\n....\n")
    (expect html).to include('<div class="imageblock kroki">')
  end

  context 'with the limits of the HTTP client' do
    # Serves a raw HTTP response, and optionally stalls before closing the connection.
    def with_server(response, stall: false)
      server = TCPServer.new('127.0.0.1', 0)
      thread = Thread.new do
        client = server.accept
        while (line = client.gets) && line != "\r\n"; end
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

    it 'should reject a response larger than the limit, even without a content-length' do
      stub_const('AsciidoctorExtensions::KrokiHttpLimits::MAX_RESPONSE_SIZE', 10)
      with_server("HTTP/1.1 200 OK\r\nConnection: close\r\n\r\n#{'x' * 100}") do |url|
        (expect { client.get("#{url}/a", {}, 'utf8') }).to raise_error(/exceeds maximum size of 10 bytes/)
      end
    end
    it 'should reject a response whose content-length exceeds the limit' do
      stub_const('AsciidoctorExtensions::KrokiHttpLimits::MAX_RESPONSE_SIZE', 10)
      with_server("HTTP/1.1 200 OK\r\nContent-Length: 100\r\n\r\n") do |url|
        (expect { client.post("#{url}/a", 'data', {}, 'utf8') }).to raise_error(/exceeds maximum size of 10 bytes/)
      end
    end
    it 'should apply the timeout until the response body is fully received' do
      stub_const('AsciidoctorExtensions::KrokiHttpLimits::TIMEOUT', 0.2)
      with_server("HTTP/1.1 200 OK\r\nContent-Length: 100\r\n\r\nxx", stall: true) do |url|
        (expect { client.get("#{url}/a", {}, 'utf8') }).to raise_error(/timed out after 0.2s/)
      end
    end
    it 'should return the body of a response below the limit' do
      with_server("HTTP/1.1 200 OK\r\nContent-Length: 2\r\nContent-Type: text/plain\r\n\r\nok") do |url|
        (expect client.get("#{url}/a", {}, 'utf8', 'text/plain')).to eq 'ok'
      end
    end
    it 'should apply the limit to a remote block macro target' do
      stub_const('AsciidoctorExtensions::KrokiHttpLimits::MAX_RESPONSE_SIZE', 10)
      with_server("HTTP/1.1 200 OK\r\nConnection: close\r\n\r\n#{'x' * 100}") do |url|
        html, logs = convert("plantuml::#{url}/a.puml[]\n", attributes: { 'allow-uri-read' => '' })
        (expect html).to include('kroki-error')
        (expect logs.join).to include('exceeds maximum size of 10 bytes')
      end
    end
  end
end
