# frozen_string_literal: true

require 'rspec_helper'
require 'asciidoctor'
require 'tmpdir'
require_relative '../lib/asciidoctor/extensions/asciidoctor_kroki'

describe AsciidoctorExtensions::KrokiDiagram do
  it 'should compute a diagram URI' do
    kroki_diagram = AsciidoctorExtensions::KrokiDiagram.new('vegalite', 'png', '{}')
    diagram_uri = kroki_diagram.get_diagram_uri('http://localhost:8000')
    expect(diagram_uri).to eq('http://localhost:8000/vegalite/png/eNqrrgUAAXUA-Q==')
  end
  it 'should compute a diagram URI with a trailing slashes' do
    kroki_diagram = AsciidoctorExtensions::KrokiDiagram.new('vegalite', 'png', '{}')
    diagram_uri = kroki_diagram.get_diagram_uri('https://my.domain.org/kroki/')
    expect(diagram_uri).to eq('https://my.domain.org/kroki/vegalite/png/eNqrrgUAAXUA-Q==')
  end
  it 'should compute a diagram URI with trailing slashes' do
    kroki_diagram = AsciidoctorExtensions::KrokiDiagram.new('vegalite', 'png', '{}')
    diagram_uri = kroki_diagram.get_diagram_uri('https://my-server/kroki//')
    expect(diagram_uri).to eq('https://my-server/kroki/vegalite/png/eNqrrgUAAXUA-Q==')
  end
  it 'should compute a diagram URI with query parameters' do
    text = %q{
       .---.
      /-o-/--
   .-/ / /->
  ( *  \/
   '-.  \
    \ /
     '
    }
    opts = {
      'stroke-width' => 1,
      'background' => 'black'
    }
    kroki_diagram = AsciidoctorExtensions::KrokiDiagram.new('svgbob', 'png', text, nil, opts)
    diagram_uri = kroki_diagram.get_diagram_uri('http://localhost:8000')
    expect(diagram_uri).to eq('http://localhost:8000/svgbob/png/eNrjUoAAPV1dXT0uCFtfN19XX1eXCyysrwCEunZAjoaCloJCjD5IWF1XD8gEK49R0IdoUwdTAN3kC7U=?stroke-width=1&background=black')
  end
  it 'should encode a diagram text definition' do
    kroki_diagram = AsciidoctorExtensions::KrokiDiagram.new('plantuml', 'txt', ' alice -> bob: hello')
    diagram_definition_encoded = kroki_diagram.encode
    expect(diagram_definition_encoded).to eq('eNpTSMzJTE5V0LVTSMpPslLISM3JyQcAQAwGaw==')
  end
  it 'should fetch a diagram from Kroki and save it to disk' do
    kroki_diagram = AsciidoctorExtensions::KrokiDiagram.new('plantuml', 'txt', ' alice -> bob: hello')
    kroki_http_client = AsciidoctorExtensions::KrokiHttpClient
    kroki_client = AsciidoctorExtensions::KrokiClient.new(server_url: 'https://kroki.io', http_method: 'get', http_client: kroki_http_client)
    output_dir_path = "#{__dir__}/../.asciidoctor/kroki"
    diagram_name = kroki_diagram.save(output_dir_path, kroki_client)
    diagram_path = File.join(output_dir_path, diagram_name)
    expect(File.exist?(diagram_path)).to be_truthy, "diagram should be saved at: #{diagram_path}"
    content = <<-TXT.chomp
     ,-----.          ,---.
     |alice|          |bob|
     `--+--'          `-+-'
        |    hello      |
        |-------------->|
     ,--+--.          ,-+-.
     |alice|          |bob|
     `-----'          `---'
    TXT
    expect(File.read(diagram_path).split("\n").map(&:rstrip).join("\n")).to eq(content)
  end
  it 'should fetch a diagram from Kroki and save it to disk using the target name' do
    kroki_diagram = AsciidoctorExtensions::KrokiDiagram.new('plantuml', 'txt', ' alice -> bob: hello', 'hello-world')
    kroki_http_client = AsciidoctorExtensions::KrokiHttpClient
    kroki_client = AsciidoctorExtensions::KrokiClient.new(server_url: 'https://kroki.io', http_method: 'get', http_client: kroki_http_client)
    output_dir_path = "#{__dir__}/../.asciidoctor/kroki"
    diagram_name = kroki_diagram.save(output_dir_path, kroki_client)
    diagram_path = File.join(output_dir_path, diagram_name)
    expect(diagram_name).to eq('hello-world.txt'), "diagram name should be the target name without a checksum, got: #{diagram_name}"
    expect(File.exist?(diagram_path)).to be_truthy, "diagram should be saved at: #{diagram_path}"
    content = <<-TXT.chomp
     ,-----.          ,---.
     |alice|          |bob|
     `--+--'          `-+-'
        |    hello      |
        |-------------->|
     ,--+--.          ,-+-.
     |alice|          |bob|
     `-----'          `---'
    TXT
    expect(File.read(diagram_path).split("\n").map(&:rstrip).join("\n")).to eq(content)
  end
  it 'should fetch a diagram from Kroki with the same definition only once' do
    kroki_diagram = AsciidoctorExtensions::KrokiDiagram.new('plantuml', 'png', ' guillaume -> dan: hello')
    kroki_http_client = AsciidoctorExtensions::KrokiHttpClient
    kroki_client = AsciidoctorExtensions::KrokiClient.new(server_url: 'https://kroki.io', http_method: 'get', http_client: kroki_http_client)
    output_dir_path = "#{__dir__}/../.asciidoctor/kroki"
    # make sure that we are doing only one GET request
    diagram_contents = File.read("#{__dir__}/fixtures/plantuml-diagram.png", mode: 'rb')
    expect(kroki_http_client).to receive(:get).once.and_return(diagram_contents)
    diagram_name = kroki_diagram.save(output_dir_path, kroki_client)
    diagram_path = File.join(output_dir_path, diagram_name)
    expect(File.exist?(diagram_path)).to be_truthy, "diagram should be saved at: #{diagram_path}"
    # calling again... should read the file from disk (and not do a GET request)
    kroki_diagram.save(output_dir_path, kroki_client)
    expect(File.size(diagram_path)).to be_eql(diagram_contents.length), 'diagram should be fully saved on disk'
  end
  it 'should warn when the same target name is reused for diagrams with different content' do
    generated_files = {}
    logger = double('logger', warn: nil)
    kroki_http_client = AsciidoctorExtensions::KrokiHttpClient
    kroki_client = AsciidoctorExtensions::KrokiClient.new(server_url: 'https://kroki.io', http_method: 'get', http_client: kroki_http_client)
    output_dir_path = "#{__dir__}/../.asciidoctor/kroki"
    allow(kroki_http_client).to receive(:get).and_return('content')
    AsciidoctorExtensions::KrokiDiagram.new('plantuml', 'svg', 'alice -> bob', 'shared').save(output_dir_path, kroki_client, generated_files, logger)
    AsciidoctorExtensions::KrokiDiagram.new('plantuml', 'svg', 'carol -> dave', 'shared').save(output_dir_path, kroki_client, generated_files, logger)
    expect(logger).to have_received(:warn).once
  end
  it 'should not warn when the same target name maps to the same diagram' do
    generated_files = {}
    logger = double('logger', warn: nil)
    kroki_http_client = AsciidoctorExtensions::KrokiHttpClient
    kroki_client = AsciidoctorExtensions::KrokiClient.new(server_url: 'https://kroki.io', http_method: 'get', http_client: kroki_http_client)
    output_dir_path = "#{__dir__}/../.asciidoctor/kroki"
    allow(kroki_http_client).to receive(:get).and_return('content')
    2.times do
      AsciidoctorExtensions::KrokiDiagram.new('plantuml', 'svg', 'alice -> bob', 'shared').save(output_dir_path, kroki_client, generated_files, logger)
    end
    expect(logger).not_to have_received(:warn)
  end

  describe 'persistent cache' do
    let(:cache_dir) { Dir.mktmpdir('kroki-diagram-cache-spec-') }

    after do
      FileUtils.rm_rf(cache_dir)
    end

    # Each call gets its own fresh, empty output dir: simulates a build that wipes the output
    # directory between runs, e.g. Antora (#113). The persistent cache is the only thing that
    # can still avoid a re-fetch in that case.
    def wiped_output_dir
      Dir.mktmpdir('kroki-diagram-output-spec-')
    end

    def counting_client(server_url = 'https://kroki.io')
      calls = 0
      client = double('kroki_client', server_url: server_url)
      allow(client).to receive(:get_image) do
        calls += 1
        '<svg/>'
      end
      [client, -> { calls }]
    end

    it 'fetches an anonymous diagram once and serves it from the persistent cache on a later build' do
      client, fetched = counting_client
      diagram = AsciidoctorExtensions::KrokiDiagram.new('plantuml', 'svg', 'CACHE1 alice -> bob')
      cache_mode = { enabled: true, refresh: false }

      diagram.save(wiped_output_dir, client, nil, nil, cache_dir: cache_dir, cache_mode: cache_mode)
      diagram.save(wiped_output_dir, client, nil, nil, cache_dir: cache_dir, cache_mode: cache_mode)

      expect(fetched.call).to eq(1)
    end

    it 'fetches a named diagram once and serves it from the persistent cache on a later build (#90)' do
      client, fetched = counting_client
      diagram = AsciidoctorExtensions::KrokiDiagram.new('plantuml', 'svg', 'CACHE2 alice -> bob', 'foo')
      cache_mode = { enabled: true, refresh: false }

      diagram.save(wiped_output_dir, client, nil, nil, cache_dir: cache_dir, cache_mode: cache_mode)
      diagram.save(wiped_output_dir, client, nil, nil, cache_dir: cache_dir, cache_mode: cache_mode)

      expect(fetched.call).to eq(1)
    end

    it 're-fetches a named diagram whose content changed even with a persistent cache hit for the old content' do
      client, fetched = counting_client
      cache_mode = { enabled: true, refresh: false }
      original = AsciidoctorExtensions::KrokiDiagram.new('plantuml', 'svg', 'CACHE3-BEFORE', 'foo')
      changed = AsciidoctorExtensions::KrokiDiagram.new('plantuml', 'svg', 'CACHE3-AFTER', 'foo')

      original.save(wiped_output_dir, client, nil, nil, cache_dir: cache_dir, cache_mode: cache_mode)
      changed.save(wiped_output_dir, client, nil, nil, cache_dir: cache_dir, cache_mode: cache_mode)

      expect(fetched.call).to eq(2)
    end

    it 'kroki-cache disabled re-fetches every time even when the same content was cached before' do
      client, fetched = counting_client
      diagram = AsciidoctorExtensions::KrokiDiagram.new('plantuml', 'svg', 'CACHE4 alice -> bob')

      diagram.save(wiped_output_dir, client, nil, nil, cache_dir: cache_dir, cache_mode: { enabled: true, refresh: false })
      diagram.save(wiped_output_dir, client, nil, nil, cache_dir: cache_dir, cache_mode: { enabled: false, refresh: false })

      expect(fetched.call).to eq(2)
    end

    it 'refresh mode bypasses the cached read but still updates the cache' do
      client, fetched = counting_client
      diagram = AsciidoctorExtensions::KrokiDiagram.new('plantuml', 'svg', 'CACHE5 alice -> bob')

      diagram.save(wiped_output_dir, client, nil, nil, cache_dir: cache_dir, cache_mode: { enabled: true, refresh: false })
      diagram.save(wiped_output_dir, client, nil, nil, cache_dir: cache_dir, cache_mode: { enabled: true, refresh: true })

      # A third, plain read should now see the refreshed content without fetching again.
      read_back_client, read_back_fetched = counting_client
      diagram.save(wiped_output_dir, read_back_client, nil, nil, cache_dir: cache_dir, cache_mode: { enabled: true, refresh: false })

      expect(fetched.call).to eq(2)
      expect(read_back_fetched.call).to eq(0)
    end

    it 'is host-dependent: the same content on a different server is fetched again' do
      client, fetched = counting_client('https://kroki.io')
      other_server_client, other_server_fetched = counting_client('https://localhost:8000')
      diagram = AsciidoctorExtensions::KrokiDiagram.new('plantuml', 'svg', 'CACHE6 alice -> bob')
      cache_mode = { enabled: true, refresh: false }

      diagram.save(wiped_output_dir, client, nil, nil, cache_dir: cache_dir, cache_mode: cache_mode)
      diagram.save(wiped_output_dir, other_server_client, nil, nil, cache_dir: cache_dir, cache_mode: cache_mode)

      expect(fetched.call + other_server_fetched.call).to eq(2)
    end

    it 'serves data-URI output from the persistent cache when enabled' do
      client, fetched = counting_client
      diagram = AsciidoctorExtensions::KrokiDiagram.new('plantuml', 'svg', 'CACHE7 alice -> bob')
      cache_mode = { enabled: true, refresh: false }

      first = diagram.to_data_uri(client, cache_dir: cache_dir, cache_mode: cache_mode)
      second = diagram.to_data_uri(client, cache_dir: cache_dir, cache_mode: cache_mode)

      expect(first).to eq("data:image/svg+xml;base64,#{['<svg/>'].pack('m0')}")
      expect(second).to eq(first)
      expect(fetched.call).to eq(1)
    end

    it 'does not use the persistent cache for data-URI output by default (inline option)' do
      client, fetched = counting_client
      diagram = AsciidoctorExtensions::KrokiDiagram.new('plantuml', 'svg', 'CACHE8 alice -> bob')

      2.times { diagram.to_data_uri(client) }

      expect(fetched.call).to eq(2)
    end

    [
      ['linked', ->(diagram, client, options) { diagram.save(wiped_output_dir, client, nil, nil, **options) }],
      ['data-uri', ->(diagram, client, options) { diagram.to_data_uri(client, **options) }]
    ].each do |mode, render|
      it "renders and reports the error when the cache directory is not writable (#{mode})" do
        client, fetched = counting_client
        errors = []
        # A cache directory nested under a regular file can never be created, even as root.
        File.write(File.join(cache_dir, 'file'), '')
        options = { cache_dir: File.join(cache_dir, 'file', 'kroki'), cache_mode: { enabled: true, refresh: false },
                    on_cache_error: ->(error) { errors << error } }

        result = instance_exec(AsciidoctorExtensions::KrokiDiagram.new('plantuml', 'svg', "RO-#{mode}"), client, options, &render)

        expect(result).not_to be_nil
        expect(fetched.call).to eq(1)
        expect(errors.size).to eq(1)
        expect(errors.first).to be_a(SystemCallError)
      end
    end

    it 'falls back to fetching the diagram when a cache entry cannot be read' do
      client, fetched = counting_client
      diagram = AsciidoctorExtensions::KrokiDiagram.new('plantuml', 'svg', 'UNREADABLE alice -> bob')
      errors = []
      key = AsciidoctorExtensions::KrokiCache.content_key(diagram, 'https://kroki.io')
      AsciidoctorExtensions::KrokiCache.write_to_cache(cache_dir, key, 'svg', '<svg>stale</svg>')
      # Simulated rather than set up on disk: file permissions are not enforced for root,
      # and directory sizes (used to detect empty entries) differ across platforms.
      allow(AsciidoctorExtensions::KrokiCache).to receive(:read_from_cache).and_raise(Errno::EACCES)

      result = diagram.to_data_uri(client, cache_dir: cache_dir, cache_mode: { enabled: true, refresh: false },
                                           on_cache_error: ->(error) { errors << error })

      expect(result).to eq("data:image/svg+xml;base64,#{['<svg/>'].pack('m0')}")
      expect(fetched.call).to eq(1)
      expect(errors.size).to eq(1)
      expect(errors.first).to be_a(Errno::EACCES)
      # The freshly fetched diagram replaces the unreadable entry.
      expect(File.read(File.join(cache_dir, "#{key}.svg"), mode: 'rb')).to eq('<svg/>')
    end
  end
end
