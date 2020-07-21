# frozen_string_literal: true

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
    it 'should use png if env-idea is defined' do
      input = <<~'ADOC'
        [plantuml]
        ....
        alice -> bob: hello
        ....
      ADOC
      output = Asciidoctor.convert(input, attributes: { 'env-idea' => '' }, standalone: false)
      (expect output).to eql %(<div class="imageblock kroki">
<div class="content">
<img src="https://kroki.io/plantuml/png/eNpLzMlMTlXQtVNIyk-yUshIzcnJBwA9iwZL" alt="Diagram">
</div>
</div>)
    end
    it 'should include the plantuml-config file' do
      input = <<~'ADOC'
        [plantuml]
        ....
        alice -> bob: hello
        ....
      ADOC
      output = Asciidoctor.convert(input, attributes: { 'env-idea' => '', 'kroki-plantuml-config' => 'spec/fixtures/config.puml' }, standalone: false)
      (expect output).to eql %(<div class="imageblock kroki">
<div class="content">
<img src="https://kroki.io/plantuml/png/eNorzs7MK0gsSsxVyM3Py0_OKMrPTVUoKSpN5YrJS8zJTE5V0LVTSMpPslLISM3JyQcArVsRHA==" alt="Diagram">
</div>
</div>)
    end
  end
end
