# frozen_string_literal: true

require 'rspec_helper'
require 'asciidoctor'
require_relative '../lib/asciidoctor/extensions/asciidoctor_kroki'
require_relative '../lib/asciidoctor/extensions/asciidoctor_kroki/extension'

describe ::AsciidoctorExtensions::KrokiBlockMacroProcessor do
  context 'convert to html5' do
    it 'should catch exception if target is not readable' do
      input = <<~'ADOC'
        plantuml::spec/fixtures/missing.puml[svg,role=sequence]
      ADOC
      output = Asciidoctor.convert(input, standalone: false)
      (expect output).to eql %(<div class="paragraph">
<p>Unresolved block macro - plantuml::spec/fixtures/missing.puml[]</p>
</div>)
    end
  end
  context 'using a custom block macro' do
    it 'should disallow read' do
      # noinspection RubyClassModuleNamingConvention
      class DisallowReadKrokiBlockMacroProcessor < ::AsciidoctorExtensions::KrokiBlockMacroProcessor
        def read_allowed?
          false
        end
      end
      registry = Asciidoctor::Extensions.create do
        block_macro DisallowReadKrokiBlockMacroProcessor, 'plantuml'
      end
      input = <<~'ADOC'
        plantuml::spec/fixtures/alice.puml[svg,role=sequence]
      ADOC
      output = Asciidoctor.convert(input, standalone: false, extension_registry: registry)
      (expect output).to eql %(<div class="paragraph">
<p><a href="spec/fixtures/alice.puml">spec/fixtures/alice.puml</a></p>
</div>)
    end
    it 'should override the unresolved target message' do
      # noinspection RubyClassModuleNamingConvention
      class CustomUnresolvedTargetMessageKrokiBlockMacroProcessor < ::AsciidoctorExtensions::KrokiBlockMacroProcessor
        def unresolved_target_message(target, name)
          "[ERROR: #{name}::#{target}[] - unresolved block macro]"
        end
      end
      registry = Asciidoctor::Extensions.create do
        block_macro CustomUnresolvedTargetMessageKrokiBlockMacroProcessor, 'plantuml'
      end
      input = <<~'ADOC'
        plantuml::spec/fixtures/missing.puml[svg,role=sequence]
      ADOC
      output = Asciidoctor.convert(input, standalone: false, extension_registry: registry)
      (expect output).to eql %(<div class="paragraph">
<p>[ERROR: plantuml::spec/fixtures/missing.puml[] - unresolved block macro]</p>
</div>)
    end
  end
end
