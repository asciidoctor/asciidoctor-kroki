# frozen_string_literal: true

require 'rspec_helper'
require 'asciidoctor'
require 'zlib'
require 'tmpdir'
require_relative '../lib/asciidoctor/extensions/asciidoctor_kroki'

describe AsciidoctorExtensions::KrokiBlockProcessor do
  context 'convert to html5' do
    it 'should convert a PlantUML block to an image' do
      input = <<~ADOC
        [plantuml]
        ....
        alice -> bob: hello
        ....
      ADOC
      output = Asciidoctor.convert(input, standalone: false)
      (expect output).to eql %(<div class="imageblock kroki">
<div class="content">
<img src="https://kroki.io/plantuml/svg/eNpLzMlMTlXQtVNIyk-yUshIzcnJBwA9iwZL" alt="Diagram">
</div>
</div>)
    end
    it 'should only pass diagram options as query parameters' do
      input = <<~ADOC
        [plantuml,alice-bob,svg,role=sequence,width=100,format=svg,link=https://asciidoc.org/,align=center,float=right,theme=bluegray]
        ....
        alice -> bob: hello
        ....
      ADOC
      output = Asciidoctor.convert(input, standalone: false)
      (expect output).to eql %(<div class="imageblock right text-center sequence kroki-format-svg kroki">
<div class="content">
<a class="image" href="https://asciidoc.org/"><img src="https://kroki.io/plantuml/svg/eNpLzMlMTlXQtVNIyk-yUshIzcnJBwA9iwZL?theme=bluegray" alt="alice-bob" width="100"></a>
</div>
</div>)
    end
    it 'should use the title attribute as the alt value' do
      input = <<~ADOC
        [plantuml,title="Alice saying hello to Bob"]
        ....
        alice -> bob: hello
        ....
      ADOC
      output = Asciidoctor.convert(input, standalone: false)
      (expect output).to eql %(<div class="imageblock kroki">
<div class="content">
<img src="https://kroki.io/plantuml/svg/eNpLzMlMTlXQtVNIyk-yUshIzcnJBwA9iwZL" alt="Alice saying hello to Bob">
</div>
<div class="title">Figure 1. Alice saying hello to Bob</div>
</div>)
    end
    it 'should use png if kroki-default-format is set to png' do
      input = <<~ADOC
        [plantuml]
        ....
        alice -> bob: hello
        ....
      ADOC
      output = Asciidoctor.convert(input, attributes: { 'kroki-default-format' => 'png' }, standalone: false)
      (expect output).to eql %(<div class="imageblock kroki">
<div class="content">
<img src="https://kroki.io/plantuml/png/eNpLzMlMTlXQtVNIyk-yUshIzcnJBwA9iwZL" alt="Diagram">
</div>
</div>)
    end
    it 'should use svg if kroki-default-format is set to png and the diagram type does not support png' do
      input = <<~ADOC
        [nomnoml]
        ....
        [Pirate|eyeCount: Int|raid();pillage()|
          [beard]--[parrot]
          [beard]-:>[foul mouth]
        ]
        ....
      ADOC
      output = Asciidoctor.convert(input, attributes: { 'kroki-default-format' => 'png' }, standalone: false)
      (expect output).to eql %(<div class="imageblock kroki">
<div class="content">
<img src="https://kroki.io/nomnoml/svg/eNqLDsgsSixJrUmtTHXOL80rsVLwzCupKUrMTNHQtC7IzMlJTE_V0KzhUlCITkpNLEqJ1dWNLkgsKsoviUUSs7KLTssvzVHIzS8tyYjligUAMhEd0g==" alt="Diagram">
</div>
</div>)
    end
    it 'should include the plantuml-include file when safe mode is safe' do
      input = <<~ADOC
        [plantuml]
        ....
        alice -> bob: hello
        ....
      ADOC
      output = Asciidoctor.convert(input,
                                   attributes: { 'kroki-plantuml-include' => 'spec/fixtures/config.puml' },
                                   standalone: false, safe: :safe)
      (expect output).to eql %(<div class="imageblock kroki">
<div class="content">
<img src="https://kroki.io/plantuml/svg/eNorzs7MK0gsSsxVyM3Py0_OKMrPTVUoKSpN5eJKzMlMTlXQtVNIyk-yUshIzcnJBwCT9xBc" alt="Diagram">
</div>
</div>)
    end
    it 'should normalize plantuml-include path when safe mode is safe' do
      input = <<~ADOC
        [plantuml]
        ....
        alice -> bob: hello
        ....
      ADOC
      output = Asciidoctor.convert(input, attributes: { 'kroki-plantuml-include' => '../../../spec/fixtures/config.puml' }, standalone: false, safe: :safe)
      (expect output).to eql %(<div class="imageblock kroki">
<div class="content">
<img src="https://kroki.io/plantuml/svg/eNorzs7MK0gsSsxVyM3Py0_OKMrPTVUoKSpN5eJKzMlMTlXQtVNIyk-yUshIzcnJBwCT9xBc" alt="Diagram">
</div>
</div>)
    end
    it 'should not include file which reside outside of the parent directory of the source when safe mode is safe' do
      input = <<~ADOC
        [plantuml]
        ....
        alice -> bob: hello
        ....
      ADOC
      output = Asciidoctor.convert(input, attributes: { 'kroki-plantuml-include' => '/etc/passwd' }, standalone: false, safe: :safe)
      (expect output).to eql %(<div class="imageblock kroki">
<div class="content">
<img src="https://kroki.io/plantuml/svg/eNpLzMlMTlXQtVNIyk-yUshIzcnJBwA9iwZL" alt="Diagram">
</div>
</div>)
    end
    it 'should not include file when safe mode is secure' do
      input = <<~ADOC
        [plantuml]
        ....
        alice -> bob: hello
        ....
      ADOC
      output = Asciidoctor.convert(input, attributes: { 'kroki-plantuml-include' => 'spec/fixtures/config.puml' }, standalone: false, safe: :secure)
      (expect output).to eql %(<div class="imageblock kroki">
<div class="content">
<img src="https://kroki.io/plantuml/svg/eNpLzMlMTlXQtVNIyk-yUshIzcnJBwA9iwZL" alt="Diagram">
</div>
</div>)
    end
    it 'should also apply kroki-plantuml-include to c4plantuml diagrams' do
      input = <<~ADOC
        [c4plantuml]
        ....
        alice -> bob: hello
        ....
      ADOC
      output = Asciidoctor.convert(input,
                                   attributes: { 'kroki-plantuml-include' => 'spec/fixtures/config.puml' },
                                   standalone: false, safe: :safe)
      (expect output).to eql %(<div class="imageblock kroki">
<div class="content">
<img src="https://kroki.io/c4plantuml/svg/eNorzs7MK0gsSsxVyM3Py0_OKMrPTVUoKSpN5eJKzMlMTlXQtVNIyk-yUshIzcnJBwCT9xBc" alt="Diagram">
</div>
</div>)
    end
    it 'should resolve !include from a single directory in kroki-plantuml-include-paths' do
      fixtures_dir = File.expand_path('../../test/fixtures', __dir__)
      styles_dir = File.join(fixtures_dir, 'plantuml/styles')
      general = File.read(File.join(styles_dir, 'general.iuml'))
      note = File.read(File.join(styles_dir, 'note.iuml'))
      sequence = File.read(File.join(styles_dir, 'sequence.iuml'))
      diagram_text = "#{general}\n#{note}\n#{sequence}\nBob->Alice: Hello"
      file = File.join(fixtures_dir, 'plantuml/diagrams/hello-with-style.puml')
      input = "plantuml::#{file}[svg,role=sequence]"
      output = Asciidoctor.convert(input, attributes: { 'kroki-plantuml-include-paths' => styles_dir }, standalone: false, safe: :safe, base_dir: fixtures_dir)
      encoded = [Zlib::Deflate.deflate(diagram_text, 9)].pack('m0').tr('+/', '-_')
      (expect output).to include(%(<img src="https://kroki.io/plantuml/svg/#{encoded}" alt="Diagram">))
    end
    it 'should resolve !include from multiple directories in kroki-plantuml-include-paths' do
      fixtures_dir = File.expand_path('../../test/fixtures', __dir__)
      styles_dir = File.join(fixtures_dir, 'plantuml/styles')
      include_dir = File.join(fixtures_dir, 'plantuml/include')
      base = File.read(File.join(include_dir, 'base.iuml'))
      note = File.read(File.join(styles_dir, 'note.iuml'))
      diagram_text = "#{base}\n#{note}\nBob->Alice: Hello"
      file = File.join(fixtures_dir, 'plantuml/diagrams/hello-with-base-and-note.puml')
      input = "plantuml::#{file}[svg,role=sequence]"
      output = Asciidoctor.convert(input, attributes: { 'kroki-plantuml-include-paths' => [styles_dir, include_dir].join(File::PATH_SEPARATOR) }, standalone: false, safe: :safe,
                                          base_dir: fixtures_dir)
      encoded = [Zlib::Deflate.deflate(diagram_text, 9)].pack('m0').tr('+/', '-_')
      (expect output).to include(%(<img src="https://kroki.io/plantuml/svg/#{encoded}" alt="Diagram">))
    end
    it 'should resolve !include relative to the target file directory for a block macro, without kroki-plantuml-include-paths' do
      fixtures_dir = File.expand_path('../../test/fixtures', __dir__)
      style = File.read(File.join(fixtures_dir, 'docs/diagrams/style.puml'))
      diagram_text = "#{style}\n\nBob->Alice: Hello"
      file = File.join(fixtures_dir, 'docs/diagrams/hello.puml')
      input = "plantuml::#{file}[svg,role=sequence]"
      output = Asciidoctor.convert(input, standalone: false, safe: :safe, base_dir: fixtures_dir)
      encoded = [Zlib::Deflate.deflate(diagram_text, 9)].pack('m0').tr('+/', '-_')
      (expect output).to include(%(<img src="https://kroki.io/plantuml/svg/#{encoded}" alt="Diagram">))
    end
    it 'should resolve !include from kroki-plantuml-include-paths in a plain block (no macro, no file context)' do
      input = <<~ADOC
        [plantuml]
        ....
        !include general.iuml
        alice -> bob: hello
        ....
      ADOC
      styles_dir = File.expand_path('../../test/fixtures/plantuml/styles', __dir__)
      included = File.read(File.join(styles_dir, 'general.iuml'))
      diagram_text = "#{included}\nalice -> bob: hello"
      output = Asciidoctor.convert(input, attributes: { 'kroki-plantuml-include-paths' => styles_dir }, standalone: false, safe: :safe)
      encoded = [Zlib::Deflate.deflate(diagram_text, 9)].pack('m0').tr('+/', '-_')
      (expect output).to include(%(<img src="https://kroki.io/plantuml/svg/#{encoded}" alt="Diagram">))
    end
    it 'should resolve !include written directly in a c4plantuml block body, not just via kroki-plantuml-include' do
      input = <<~ADOC
        [c4plantuml]
        ....
        !include spec/fixtures/config.puml
        alice -> bob: hello
        ....
      ADOC
      config = File.read('spec/fixtures/config.puml')
      diagram_text = "#{config}\nalice -> bob: hello"
      output = Asciidoctor.convert(input, standalone: false, safe: :safe)
      encoded = [Zlib::Deflate.deflate(diagram_text, 9)].pack('m0').tr('+/', '-_')
      (expect output).to include(%(<img src="https://kroki.io/c4plantuml/svg/#{encoded}" alt="Diagram">))
    end
    it 'should not resolve a plain !include written in the diagram body when safe mode is secure' do
      input = <<~ADOC
        [plantuml]
        ....
        !include spec/fixtures/config.puml
        alice -> bob: hello
        ....
      ADOC
      # Unresolved: the literal !include line is sent to Kroki as-is, unlike the safe/unsafe/server case.
      unresolved_diagram_text = "!include spec/fixtures/config.puml\nalice -> bob: hello"
      output = Asciidoctor.convert(input, standalone: false, safe: :secure)
      encoded = [Zlib::Deflate.deflate(unresolved_diagram_text, 9)].pack('m0').tr('+/', '-_')
      (expect output).to include(%(<img src="https://kroki.io/plantuml/svg/#{encoded}" alt="Diagram">))
    end
    context 'with kroki-fetch-diagram writing to disk' do
      # The persistent cache (see cache.rb) defaults to $XDG_CACHE_HOME/kroki (or ~/.cache/kroki);
      # point it at a throwaway directory here so this real end-to-end conversion spec never
      # touches the developer's actual cache.
      around do |example|
        original_xdg_cache_home = ENV.fetch('XDG_CACHE_HOME', nil)
        temp_cache_dir = Dir.mktmpdir('kroki-spec-cache-')
        ENV['XDG_CACHE_HOME'] = temp_cache_dir
        example.run
        if original_xdg_cache_home.nil?
          ENV.delete('XDG_CACHE_HOME')
        else
          ENV['XDG_CACHE_HOME'] = original_xdg_cache_home
        end
        FileUtils.rm_rf(temp_cache_dir)
      end

      it 'should create SVG diagram in imagesdir if kroki-fetch-diagram is set' do
        input = <<~ADOC
          :imagesdir: .asciidoctor/kroki

          plantuml::spec/fixtures/alice.puml[svg,role=sequence]
        ADOC
        output = Asciidoctor.convert(input, attributes: { 'kroki-fetch-diagram' => '' }, standalone: false, safe: :safe)
        (expect output).to eql %(<div class="imageblock sequence kroki-format-svg kroki">
<div class="content">
<img src=".asciidoctor/kroki/diag-f6acdc206506b6ca7badd3fe722f252af992871426e580c8361ff4d47c2c7d9b.svg" alt="Diagram">
</div>
</div>)
      end
      it 'should not fetch diagram when safe mode is secure' do
        input = <<~ADOC
          :imagesdir: .asciidoctor/kroki

          plantuml::spec/fixtures/alice.puml[svg,role=sequence]
        ADOC
        output = Asciidoctor.convert(input, attributes: { 'kroki-fetch-diagram' => '' }, standalone: false)
        (expect output).to eql %(<div class="imageblock sequence kroki-format-svg kroki">
<div class="content">
<img src="https://kroki.io/plantuml/svg/eNpLzMlMTlXQtVNIyk-yUshIzcnJ5wIAQ-AGVQ==" alt="Diagram">
</div>
</div>)
      end
      it 'should create PNG diagram in imagesdir if kroki-fetch-diagram is set' do
        input = <<~ADOC
          :imagesdir: .asciidoctor/kroki

          plantuml::spec/fixtures/alice.puml[png,role=sequence]
        ADOC
        output = Asciidoctor.convert(input, attributes: { 'kroki-fetch-diagram' => '' }, standalone: false, safe: :safe)
        (expect output).to eql %(<div class="imageblock sequence kroki-format-png kroki">
<div class="content">
<img src=".asciidoctor/kroki/diag-d4f314b2d4e75cc08aa4f8c2c944f7bf78321895d8ec5f665b42476d4e67e610.png" alt="Diagram">
</div>
</div>)
      end
    end
    context 'with kroki-fetch-diagram embedding as a data URI' do
      it 'should embed the fetched SVG as a base64 data URI when kroki-data-uri is set' do
        input = <<~ADOC
          plantuml::spec/fixtures/alice.puml[svg,role=sequence]
        ADOC
        output = Asciidoctor.convert(input, attributes: { 'kroki-fetch-diagram' => '', 'kroki-data-uri' => '' }, standalone: false, safe: :safe)
        (expect output).to match(%r{<img src="data:image/svg\+xml;base64,[A-Za-z0-9+/]+=*" alt="Diagram">})
      end
      it 'should embed the fetched PNG as a base64 data URI when the standard data-uri attribute is set' do
        input = <<~ADOC
          plantuml::spec/fixtures/alice.puml[png,role=sequence]
        ADOC
        output = Asciidoctor.convert(input, attributes: { 'kroki-fetch-diagram' => '', 'data-uri' => '' }, standalone: false, safe: :safe)
        (expect output).to match(%r{<img src="data:image/png;base64,[A-Za-z0-9+/]+=*" alt="Diagram">})
      end
      it 'should not embed as a data URI when kroki-data-uri is set but kroki-fetch-diagram is not' do
        input = <<~ADOC
          plantuml::spec/fixtures/alice.puml[svg,role=sequence]
        ADOC
        output = Asciidoctor.convert(input, attributes: { 'kroki-data-uri' => '' }, standalone: false, safe: :safe)
        (expect output).to include('<img src="https://kroki.io/plantuml/svg/')
      end
    end
  end
  context 'instantiate' do
    it 'should instantiate block processor without warning' do
      original_stderr = $stderr
      $stderr = StringIO.new
      AsciidoctorExtensions::KrokiBlockProcessor.new :plantuml, {}
      output = $stderr.string
      (expect output).to eql ''
    ensure
      $stderr = original_stderr
    end
  end
end

describe AsciidoctorExtensions::Kroki do
  it 'should return the list of supported diagrams' do
    diagram_names = AsciidoctorExtensions::Kroki::SUPPORTED_DIAGRAM_NAMES
    expect(diagram_names).to include('vegalite', 'plantuml', 'bytefield', 'bpmn', 'excalidraw', 'wavedrom', 'pikchr', 'structurizr', 'diagramsnet')
  end
  it 'should register the extension for the list of supported diagrams' do
    doc = Asciidoctor::Document.new
    registry = Asciidoctor::Extensions::Registry.new
    registry.activate doc
    AsciidoctorExtensions::Kroki::SUPPORTED_DIAGRAM_NAMES.each do |name|
      expect(registry.find_block_extension(name)).to_not be_nil, "expected block extension named '#{name}' to be registered"
      expect(registry.find_block_macro_extension(name)).to_not be_nil, "expected block macro extension named '#{name}' to be registered "
    end
  end
end
