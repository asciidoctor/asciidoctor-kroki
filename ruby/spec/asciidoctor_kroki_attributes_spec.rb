# frozen_string_literal: true

require 'rspec_helper'
require 'asciidoctor'
require_relative '../lib/asciidoctor/extensions/asciidoctor_kroki'
require_relative '../lib/asciidoctor/extensions/asciidoctor_kroki/extension'

describe AsciidoctorExtensions::KrokiBlockProcessor do
  context 'with an attribute that has no value' do
    it 'should use svg and keep a valid role class if the format attribute is empty' do
      input = <<~ADOC
        [plantuml,role=sequence,format=]
        ....
        alice -> bob: hello
        ....
      ADOC
      output = Asciidoctor.convert(input, standalone: false)
      (expect output).to eql %(<div class="imageblock sequence kroki-format-svg kroki">
<div class="content">
<img src="https://kroki.io/plantuml/svg/eNpLzMlMTlXQtVNIyk-yUshIzcnJBwA9iwZL" alt="Diagram">
</div>
</div>)
    end
    it 'should use svg if the format attribute is blank' do
      input = <<~ADOC
        [plantuml,role=sequence,format=" "]
        ....
        alice -> bob: hello
        ....
      ADOC
      output = Asciidoctor.convert(input, standalone: false)
      (expect output).to eql %(<div class="imageblock sequence kroki-format-svg kroki">
<div class="content">
<img src="https://kroki.io/plantuml/svg/eNpLzMlMTlXQtVNIyk-yUshIzcnJBwA9iwZL" alt="Diagram">
</div>
</div>)
    end
    it 'should use svg if the format attribute of a block macro is empty' do
      input = 'plantuml::spec/fixtures/alice.puml[format=]'
      output = Asciidoctor.convert(input, standalone: false, safe: :safe)
      (expect output).to eql %(<div class="imageblock kroki">
<div class="content">
<img src="https://kroki.io/plantuml/svg/eNpLzMlMTlXQtVNIyk-yUshIzcnJ5wIAQ-AGVQ==" alt="Diagram">
</div>
</div>)
    end
    [[' ', 'blank'], [true, 'true']].each do |value, description|
      it "should use svg if kroki-default-format is #{description}" do
        input = <<~ADOC
          [plantuml]
          ....
          alice -> bob: hello
          ....
        ADOC
        output = Asciidoctor.convert(input, attributes: { 'kroki-default-format' => value }, standalone: false)
        (expect output).to include('<img src="https://kroki.io/plantuml/svg/eNpLzMlMTlXQtVNIyk-yUshIzcnJBwA9iwZL" alt="Diagram">')
      end
    end
    it 'should not fail if kroki-default-format is not a string' do
      input = <<~ADOC
        [plantuml]
        ....
        alice -> bob: hello
        ....
      ADOC
      output = Asciidoctor.convert(input, attributes: { 'kroki-default-format' => 42 }, standalone: false)
      (expect output).to include('<img src="https://kroki.io/plantuml/42/eNpLzMlMTlXQtVNIyk-yUshIzcnJBwA9iwZL" alt="Diagram">')
    end
    [['', 'empty'], [' ', 'blank'], [true, 'true']].each do |value, description|
      it "should use the default server if kroki-server-url is #{description}" do
        input = <<~ADOC
          [plantuml]
          ....
          alice -> bob: hello
          ....
        ADOC
        output = Asciidoctor.convert(input, attributes: { 'kroki-server-url' => value }, standalone: false)
        (expect output).to include('<img src="https://kroki.io/plantuml/svg/eNpLzMlMTlXQtVNIyk-yUshIzcnJBwA9iwZL" alt="Diagram">')
      end
      it "should ignore kroki-plantuml-include if it is #{description}" do
        input = <<~ADOC
          [plantuml]
          ....
          alice -> bob: hello
          ....
        ADOC
        output = Asciidoctor.convert(input, attributes: { 'kroki-plantuml-include' => value }, standalone: false, safe: :safe)
        (expect output).to include('<img src="https://kroki.io/plantuml/svg/eNpLzMlMTlXQtVNIyk-yUshIzcnJBwA9iwZL" alt="Diagram">')
      end
    end
  end
end
