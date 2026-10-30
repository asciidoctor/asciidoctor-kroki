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
        @outside_dir = outside_dir
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

  context 'with a relative path' do
    it 'should resolve a !include of a block from the base directory, not from the current directory' do
      html, = convert(block('plantuml', "!include inside.puml\nalice"))
      (expect diagram_source(html)).to include('skinparam inside true')
    end
    it 'should resolve a !include from the base directory for a block macro in a subdirectory' do
      File.write(File.join(@base_dir, 'sub', 'macro.puml'), "!include inside.puml\nalice")
      html, = convert("plantuml::sub/macro.puml[]\n")
      (expect diagram_source(html)).to include('skinparam inside true')
    end
  end

  context 'with the subs attribute' do
    it 'should apply the substitutions before resolving a !include' do
      html, = convert(":incdir: #{@base_dir}\n\n[plantuml,subs=attributes+]\n....\n!include {incdir}/inside.puml\nalice\n....\n")
      (expect diagram_source(html)).to include('skinparam inside true')
    end
    it 'should not apply the substitutions to the content of a !include' do
      File.write(File.join(@base_dir, 'attribute.puml'), 'skinparam {incdir}')
      html, = convert(":incdir: value\n\n[plantuml,subs=attributes+]\n....\n!include attribute.puml\nalice\n....\n")
      (expect diagram_source(html)).to include('skinparam {incdir}')
    end
  end

  context 'with kroki-plantuml-include' do
    it 'should read a URL with allow-uri-read' do
      allow(OpenURI).to receive(:open_uri).and_return('REMOTE-CONTENT')
      html, = convert(block('plantuml', 'alice'), attributes: { 'allow-uri-read' => '', 'kroki-plantuml-include' => 'https://domain.org/a.puml' })
      (expect diagram_source(html)).to eq "REMOTE-CONTENT\nalice"
    end
    it 'should not read a URL without allow-uri-read' do
      expect(OpenURI).not_to receive(:open_uri)
      html, logs = convert(block('plantuml', 'alice'), attributes: { 'kroki-plantuml-include' => 'https://domain.org/a.puml' })
      (expect diagram_source(html)).to eq 'alice'
      (expect logs.join).to include('Unable to read plantuml-include')
    end
    it 'should warn and ignore a URL that cannot be read' do
      allow(OpenURI).to receive(:open_uri).and_raise(StandardError, 'unreachable')
      html, logs = convert(block('plantuml', 'alice'), attributes: { 'allow-uri-read' => '', 'kroki-plantuml-include' => 'https://domain.org/a.puml' })
      (expect diagram_source(html)).to eq 'alice'
      (expect logs.join).to include('Unable to read plantuml-include')
    end
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
      { 'imagesoutdir' => ->(dir) { dir }, 'imagesdir' => ->(dir) { "../#{File.basename(dir)}" }, 'outdir' => ->(dir) { dir } }.each do |name, value|
        it "should embed the diagram when the #{name} attribute of the document is outside of the base directory in #{safe} mode" do
          html, logs = convert(":#{name}: #{value.call(@outside_dir)}\n\n[plantuml,#{name}]\n....\nalice\n....\n",
                               safe: safe, attributes: { 'kroki-fetch-diagram' => '', 'kroki-cache' => 'false' })
          (expect File.exist?(File.join(@outside_dir, "#{name}.svg"))).to be false
          (expect html).to match(%r{src="data:image/svg\+xml;base64,})
          (expect logs.join).to include('embedding the diagram')
        end
      end
    end
    it 'should write to a directory of the document inside of the base directory' do
      html, logs = convert(":imagesdir: sub\n\n[plantuml,in-sub]\n....\nalice\n....\n", attributes: { 'kroki-fetch-diagram' => '', 'kroki-cache' => 'false' })
      (expect html).to include('in-sub.svg"')
      (expect File.exist?(File.join(@base_dir, 'sub', 'in-sub.svg'))).to be true
      (expect logs).to be_empty
    end
    it 'should write to a directory outside of the base directory set from the API' do
      dir = File.join(@outside_dir, 'api-images')
      html, = convert("[plantuml,api]\n....\nalice\n....\n", attributes: { 'kroki-fetch-diagram' => '', 'kroki-cache' => 'false', 'imagesoutdir' => dir })
      (expect html).to include('api.svg"')
      (expect File.exist?(File.join(dir, 'api.svg'))).to be true
    end
    it 'should ignore the kroki-cache-dir attribute of the document outside of the base directory' do
      original = ENV.fetch('XDG_CACHE_HOME', nil)
      cache_dir = File.join(@outside_dir, 'doc-cache')
      Dir.mktmpdir('kroki-xdg-') do |xdg_cache_home|
        ENV['XDG_CACHE_HOME'] = xdg_cache_home
        _, logs = convert(":kroki-cache-dir: #{cache_dir}\n\n[plantuml,a]\n....\nalice\n....\n\n[plantuml,b]\n....\nbob\n....\n",
                          attributes: { 'kroki-fetch-diagram' => '', 'imagesoutdir' => File.join(@base_dir, 'images') })
        (expect File.exist?(cache_dir)).to be false
        (expect Dir.children(File.join(xdg_cache_home, 'kroki'))).not_to be_empty
        expect(logs.count { |log| log.include?('kroki-cache-dir') }).to eq 1
      ensure
        ENV['XDG_CACHE_HOME'] = original
      end
    end
    it 'should use a kroki-cache-dir attribute outside of the base directory set from the API' do
      cache_dir = File.join(@outside_dir, 'api-cache')
      convert("[plantuml,c]\n....\nalice\n....\n",
              attributes: { 'kroki-fetch-diagram' => '', 'kroki-cache-dir' => cache_dir, 'imagesoutdir' => File.join(@base_dir, 'images') })
      (expect Dir.children(cache_dir)).not_to be_empty
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
