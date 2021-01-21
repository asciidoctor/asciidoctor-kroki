# frozen_string_literal: true

require 'rspec_helper'
require 'asciidoctor'
require_relative '../lib/asciidoctor/extensions/asciidoctor_kroki'

describe ::AsciidoctorExtensions::KrokiBlockProcessor do
  context 'convert to html5' do
    it 'should convert a PlantUML block to an image' do
      input = <<~'ADOC'
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
    it 'should use png if kroki-default-format is set to png' do
      input = <<~'ADOC'
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
      input = <<~'ADOC'
        [mermaid]
        ....
        graph TD;
          A-->B;
        ....
      ADOC
      output = Asciidoctor.convert(input, attributes: { 'kroki-default-format' => 'png' }, standalone: false)
      (expect output).to eql %(<div class="imageblock kroki">
<div class="content">
<img src="https://kroki.io/mermaid/svg/eNpLL0osyFAIcbHmUlBw1NW1c7IGADLKBKY=" alt="Diagram">
</div>
</div>)
    end
    it 'should include the plantuml-include file when safe mode is safe' do
      input = <<~'ADOC'
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
      input = <<~'ADOC'
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
      input = <<~'ADOC'
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
      input = <<~'ADOC'
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
    it 'should create SVG diagram in imagesdir if kroki-fetch-diagram is set' do
      input = <<~'ADOC'
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
      input = <<~'ADOC'
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
      input = <<~'ADOC'
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
  context 'instantiate' do
    it 'should instantiate block processor without warning' do
      original_stderr = $stderr
      $stderr = StringIO.new
      ::AsciidoctorExtensions::KrokiBlockProcessor.new :plantuml, {}
      output = $stderr.string
      (expect output).to eql ''
    ensure
      $stderr = original_stderr
    end
  end
end

describe ::AsciidoctorExtensions::Kroki do
  it 'should return the list of supported diagrams' do
    diagram_names = ::AsciidoctorExtensions::Kroki::SUPPORTED_DIAGRAM_NAMES
    expect(diagram_names).to include('vegalite', 'plantuml', 'bytefield', 'bpmn', 'excalidraw', 'wavedrom', 'pikchr', 'structurizr')
  end
  it 'should register the extension for the list of supported diagrams' do
    doc = Asciidoctor::Document.new
    registry = Asciidoctor::Extensions::Registry.new
    registry.activate doc
    ::AsciidoctorExtensions::Kroki::SUPPORTED_DIAGRAM_NAMES.each do |name|
      expect(registry.find_block_extension(name)).to_not be_nil, "expected block extension named '#{name}' to be registered"
      expect(registry.find_block_macro_extension(name)).to_not be_nil, "expected block macro extension named '#{name}' to be registered "
    end
  end
end
