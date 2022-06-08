# rubocop:disable Lint/ConstantDefinitionInBlock
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
        def read_allowed?(_target)
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
    it 'should allow read if target is not a URI' do
      # noinspection RubyClassModuleNamingConvention
      class DisallowUriReadKrokiBlockMacroProcessor < ::AsciidoctorExtensions::KrokiBlockMacroProcessor
        def read_allowed?(target)
          return false if ::Asciidoctor::Helpers.uriish?(target)

          true
        end
      end
      registry = Asciidoctor::Extensions.create do
        block_macro DisallowUriReadKrokiBlockMacroProcessor, 'plantuml'
      end
      input = <<~'ADOC'
        plantuml::https://domain.org/alice.puml[svg,role=sequence]

        plantuml::file://path/to/alice.puml[svg,role=sequence]

        plantuml::spec/fixtures/alice.puml[svg,role=sequence]
      ADOC
      output = Asciidoctor.convert(input, standalone: false, extension_registry: registry)
      (expect output).to eql %(<div class="paragraph">
<p><a href="https://domain.org/alice.puml">https://domain.org/alice.puml</a></p>
</div>
<div class="paragraph">
<p><a href="file://path/to/alice.puml">file://path/to/alice.puml</a></p>
</div>
<div class="imageblock sequence kroki-format-svg kroki">
<div class="content">
<img src="https://kroki.io/plantuml/svg/eNpLzMlMTlXQtVNIyk-yUshIzcnJ5wIAQ-AGVQ==" alt="Diagram">
</div>
</div>)
    end
    it 'should override the resolve target method' do
      # noinspection RubyClassModuleNamingConvention
      class FixtureResolveTargetKrokiBlockMacroProcessor < ::AsciidoctorExtensions::KrokiBlockMacroProcessor
        def resolve_target_path(target)
          "spec/fixtures/#{target}"
        end
      end
      registry = Asciidoctor::Extensions.create do
        block_macro FixtureResolveTargetKrokiBlockMacroProcessor, 'plantuml'
      end
      input = <<~'ADOC'
        plantuml::alice.puml[svg,role=sequence]
      ADOC
      output = Asciidoctor.convert(input, standalone: false, extension_registry: registry)
      (expect output).to eql %(<div class="imageblock sequence kroki-format-svg kroki">
<div class="content">
<img src="https://kroki.io/plantuml/svg/eNpLzMlMTlXQtVNIyk-yUshIzcnJ5wIAQ-AGVQ==" alt="Diagram">
</div>
</div>)
    end
    it 'should display unresolved block macro message when the target cannot be resolved' do
      # noinspection RubyClassModuleNamingConvention
      class UnresolvedTargetKrokiBlockMacroProcessor < ::AsciidoctorExtensions::KrokiBlockMacroProcessor
        def resolve_target_path(_target)
          nil
        end
      end
      registry = Asciidoctor::Extensions.create do
        block_macro UnresolvedTargetKrokiBlockMacroProcessor, 'plantuml'
      end
      input = <<~'ADOC'
        plantuml::alice.puml[svg,role=sequence]
      ADOC
      output = Asciidoctor.convert(input, standalone: false, extension_registry: registry)
      (expect output).to eql %(<div class="paragraph">
<p>Unresolved block macro - plantuml::alice.puml[]</p>
</div>)
    end
    it 'should override the unresolved block macro message' do
      # noinspection RubyClassModuleNamingConvention
      class CustomUnresolvedTargetMessageKrokiBlockMacroProcessor < ::AsciidoctorExtensions::KrokiBlockMacroProcessor
        def unresolved_block_macro_message(name, target)
          "*[ERROR: #{name}::#{target}[] - unresolved block macro]*"
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
<p><strong>[ERROR: plantuml::spec/fixtures/missing.puml[] - unresolved block macro]</strong></p>
</div>)
    end
  end
end
# rubocop:enable Lint/ConstantDefinitionInBlock
