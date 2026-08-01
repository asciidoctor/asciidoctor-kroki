# frozen_string_literal: true

require 'rspec_helper'
require_relative '../lib/asciidoctor/extensions/asciidoctor_kroki/preprocess'

# Records messages passed to #info instead of writing them anywhere, mirroring
# Asciidoctor.js's MemoryLogger used by the equivalent JS specs (test/node/preprocess.test.js).
class RecordingLogger
  attr_reader :infos

  def initialize
    @infos = []
  end

  def info(message)
    @infos << message
  end
end

describe AsciidoctorExtensions::PlantUmlPreprocessor do
  # Fixtures are shared with the JS extension's equivalent specs (test/node/preprocess.test.js)
  # rather than duplicated, so both language bindings are exercised against the same content.
  fixtures_dir = File.expand_path('../../test/fixtures/plantuml', __dir__)
  remote_base = 'https://raw.githubusercontent.com/asciidoctor/asciidoctor-kroki/master/test/fixtures/plantuml'

  let(:logger) { RecordingLogger.new }

  def preprocess(text, logger:, resource_path: nil, include_paths: nil)
    described_class.preprocess(text, resource_path, include_paths, logger)
  end

  it 'passes through unchanged when the diagram has no !include directives' do
    text = "\n      alice -> bob"
    expect(preprocess(text, logger: logger)).to eq text
  end

  it 'passes through and logs for stdlib includes (<file>) that cannot be resolved locally' do
    text = "\n      !include <std/include.iuml>\n      alice -> bob"
    expect(preprocess(text, logger: logger)).to eq text
    expect(logger.infos).to eq ["Skipping preprocessing of PlantUML standard library include '<std/include.iuml>'"]
  end

  it 'passes through and logs for a missing local !include that may exist on the Kroki server' do
    text = "\n      !include #{fixtures_dir}/unexisting.iuml\n      alice -> bob"
    expect(preprocess(text, logger: logger)).to eq text
    expect(logger.infos.length).to eq 1
    expect(logger.infos[0]).to include("Skipping preprocessing of PlantUML include, because reading the referenced local file '#{fixtures_dir}/unexisting.iuml' caused an error:")
  end

  it 'passes through and logs for a remote !include URL that cannot be fetched' do
    url = "#{remote_base}/unexisting.iuml"
    text = "\n      !include #{url}\n      alice -> bob"
    expect(preprocess(text, logger: logger)).to eq text
    expect(logger.infos.length).to eq 1
    expect(logger.infos[0]).to include("Skipping preprocessing of PlantUML include, because reading the referenced remote file '#{url}' caused an error:")
  end

  it 'inlines a local file via !include' do
    included = File.read("#{fixtures_dir}/styles/general.iuml")
    text = "\n      !include #{fixtures_dir}/styles/general.iuml\n      alice -> bob"
    expect(preprocess(text, logger: logger)).to eq "\n#{included}\n      alice -> bob"
  end

  it 'inlines a local file via !include when the diagram uses Windows line endings' do
    style_path = File.expand_path('../../test/fixtures/docs/diagrams/style.puml', __dir__)
    included = File.read(style_path)
    text = "!include #{style_path} \r\n\r\nBob->Alice: Hello\r\n"
    expect(preprocess(text, logger: logger)).to eq "#{included}\n\r\nBob->Alice: Hello\r\n"
  end

  it 'inlines only the first @startuml...@enduml block from the included file' do
    included = File.read("#{fixtures_dir}/styles/general.iuml")
    text = "\n      !include #{fixtures_dir}/styles/general.puml\n      alice -> bob"
    expect(preprocess(text, logger: logger)).to eq "\n#{included}\n      alice -> bob"
  end

  it 'strips trailing comments from the !include path' do
    path = "#{fixtures_dir}/styles/general with spaces.iuml".gsub(' ', '\\ ')
    included = File.read("#{fixtures_dir}/styles/general with spaces.iuml")
    text = "\n      !include #{path} # this includes general style\n      alice -> bob"
    expect(preprocess(text, logger: logger)).to eq "\n#{included} # this includes general style\n      alice -> bob"
  end

  it 'inlines the same file included multiple times via !include' do
    included = File.read("#{fixtures_dir}/styles/general.iuml")
    text = "\n      !include #{fixtures_dir}/styles/general.iuml\n      alice -> bob\n      !include #{fixtures_dir}/styles/general.iuml"
    expect(preprocess(text, logger: logger)).to eq "\n#{included}\n      alice -> bob\n#{included}"
  end

  it 'inlines the same file included multiple times via !include_many' do
    included = File.read("#{fixtures_dir}/styles/general.iuml")
    text = "\n      !include_many #{fixtures_dir}/styles/general.iuml\n      alice -> bob\n      !include_many #{fixtures_dir}/styles/general.iuml"
    expect(preprocess(text, logger: logger)).to eq "\n#{included}\n      alice -> bob\n#{included}"
  end

  it 'throws when the same file is included more than once via !include_once' do
    path = "#{fixtures_dir}/styles/general.iuml"
    text = "\n      !include_once #{path}\n      alice -> bob\n      !include_once #{path}"
    expect { preprocess(text, logger: logger) }
      .to raise_error("Preprocessing of PlantUML include failed, because including multiple times referenced file '#{path}' with '!include_once' guard")
  end

  it 'throws when !include_once detects a duplicate through nested includes' do
    path = "#{fixtures_dir}/styles/general.iuml"
    nested = "#{fixtures_dir}/styles/style-include-once-general.iuml"
    text = "\n      !include_once #{path}\n      alice -> bob\n      !include #{nested}"
    expect { preprocess(text, logger: logger) }
      .to raise_error("Preprocessing of PlantUML include failed, because including multiple times referenced file '#{path}' with '!include_once' guard")
  end

  it 'allows !include to include a file already seen by !include_once' do
    included = File.read("#{fixtures_dir}/styles/general.iuml")
    path = "#{fixtures_dir}/styles/general.iuml"
    text = "\n      !include_once #{path}\n      alice -> bob\n      !include #{path}"
    expect(preprocess(text, logger: logger)).to eq "\n#{included}\n      alice -> bob\n#{included}"
  end

  it 'preserves single-line and block comments in the diagram text' do
    path = "#{fixtures_dir}/styles/general.iuml"
    included = File.read(path)
    text = <<~PLANTUML.chomp
      \n      '!include #{path}' the whole line is preserved
      !include #{path}
      /'
        !include #{path}
        the whole block is preserved
      '/ alice -> bob /' this also should be preserved '/
    PLANTUML
    expected = <<~PLANTUML.chomp
      \n      '!include #{path}' the whole line is preserved
      #{included}
      /'
        !include #{path}
        the whole block is preserved
      '/ alice -> bob /' this also should be preserved '/
    PLANTUML
    expect(preprocess(text, logger: logger)).to eq expected
  end

  it 'preserves a trailing block comment at the end of the diagram' do
    path = "#{fixtures_dir}/styles/general.iuml"
    included = File.read(path)
    text = "\n      !include #{path} /'\n      this is a trailing block comment\n      '/"
    expect(preprocess(text, logger: logger)).to eq "\n#{included} /'\n      this is a trailing block comment\n      '/"
  end

  it 'inlines a local file whose path contains spaces' do
    path = "#{fixtures_dir}/styles/general with spaces.iuml".gsub(' ', '\\ ')
    included = File.read("#{fixtures_dir}/styles/general with spaces.iuml")
    text = "\n      !include #{path}\n      alice -> bob"
    expect(preprocess(text, logger: logger)).to eq "\n#{included}\n      alice -> bob"
  end

  it 'inlines a remote file via !include with an http:// URL' do
    url = "#{remote_base}/styles/general.iuml"
    included = File.read("#{fixtures_dir}/styles/general.iuml")
    text = "\n      !include #{url}\n      alice -> bob"
    expect(preprocess(text, logger: logger)).to eq "\n#{included}\n      alice -> bob"
  end

  it 'inlines a remote file via the legacy !includeurl directive' do
    url = "#{remote_base}/styles/general.iuml"
    included = File.read("#{fixtures_dir}/styles/general.iuml")
    text = "\n      !includeurl #{url}\n      alice -> bob"
    expect(preprocess(text, logger: logger)).to eq "\n#{included}\n      alice -> bob"
  end

  it 'resolves a relative !include nested inside a remote file against the remote URL (#398)' do
    url = "#{remote_base}/include/parent/shadow.iuml"
    text = "!include #{url}\nalice -> bob"
    expect(preprocess(text, logger: logger)).to eq "skinparam Shadowing false\nskinparam DefaultFontName \"Neucha\"\nskinparam BackgroundColor black\nalice -> bob"
    expect(logger.infos).to be_empty
  end

  it 'inlines multiple distinct local files via multiple !include directives' do
    included0 = File.read("#{fixtures_dir}/styles/general.iuml")
    included1 = File.read("#{fixtures_dir}/styles/note.iuml")
    included2 = File.read("#{fixtures_dir}/styles/sequence.iuml")
    text = "\n      !include #{fixtures_dir}/styles/general.iuml\n      " \
           "!include #{fixtures_dir}/styles/note.iuml\n      " \
           "!include #{fixtures_dir}/styles/sequence.iuml\n      alice -> bob"
    expect(preprocess(text, logger: logger)).to eq "\n#{included0}\n#{included1}\n#{included2}\n      alice -> bob"
  end

  it 'recursively inlines nested !include files' do
    included0 = File.read("#{fixtures_dir}/styles/general.iuml")
    included1 = File.read("#{fixtures_dir}/styles/note.iuml")
    included2 = File.read("#{fixtures_dir}/styles/sequence.iuml")
    text = "\n      !include #{fixtures_dir}/styles/style.iuml\n      alice -> bob"
    expect(preprocess(text, logger: logger)).to eq "\n#{included0}\n#{included1}\n#{included2}\n      alice -> bob"
  end

  it 'recursively inlines nested !include files with spaces in the path' do
    included0 = File.read("#{fixtures_dir}/styles/general with spaces.iuml")
    included1 = File.read("#{fixtures_dir}/styles/note.iuml")
    included2 = File.read("#{fixtures_dir}/styles/sequence.iuml")
    path = "#{fixtures_dir}/styles/style with spaces.iuml".gsub(' ', '\\ ')
    text = "\n      !include #{path}\n      alice -> bob"
    expect(preprocess(text, logger: logger)).to eq "\n#{included0}\n#{included1}\n#{included2}\n      alice -> bob"
  end

  it 'throws a cycle error when a file includes itself' do
    path = "#{fixtures_dir}/include/itself.iuml"
    text = "\n      !include #{path}\n      alice -> bob"
    expect { preprocess(text, logger: logger) }
      .to raise_error("Preprocessing of PlantUML include failed, because recursive reading already included referenced file '#{path}'")
  end

  it 'throws a cycle error when a nested include creates an ancestor cycle' do
    path = "#{fixtures_dir}/include/grand-parent.iuml"
    text = "\n      !include #{path}\n      alice -> bob"
    expect { preprocess(text, logger: logger) }
      .to raise_error("Preprocessing of PlantUML include failed, because recursive reading already included referenced file '#{path}'")
  end

  it 'inlines a named subsection via !includesub file!sub-name' do
    text = "\n      !includesub #{fixtures_dir}/diagrams/subs.puml!BASIC\n      alice -> bob"
    expect(preprocess(text, logger: logger)).to eq "\nB -> B : stuff2\nB -> B : stuff2.1\nD -> D : stuff4\nD -> D : stuff4.1\n      alice -> bob"
  end

  it 'matches only the exact sub name when the name contains a dot (regex metachar)' do
    text = "!includesub #{fixtures_dir}/diagrams/subs-with-special-chars.puml!BASIC.ONE\nalice -> bob"
    result = preprocess(text, logger: logger)
    expect(result).to include('B -> B : dot section')
    expect(result).not_to include('C -> C : should not match dot')
  end

  it 'does not throw when a sub name contains unbalanced regex metacharacters' do
    text = "!includesub #{fixtures_dir}/diagrams/subs-with-special-chars.puml!BASIC(ONE\nalice -> bob"
    result = preprocess(text, logger: logger)
    expect(result).to include('D -> D : paren section')
  end

  it 'inlines a subsection by ID via !include file!id' do
    text = "\n      !include #{fixtures_dir}/diagrams/id.puml!MY_OWN_ID1\n      !include #{fixtures_dir}/diagrams/id.puml!MY_OWN_ID2\n      alice -> bob"
    expect(preprocess(text, logger: logger)).to eq "\nA -> A : stuff1\nB -> B : stuff2\nC -> C : stuff3\nD -> D : stuff4\n      alice -> bob"
  end

  it 'inlines a subsection by numeric index via !include file!index' do
    text = "\n      !include #{fixtures_dir}/diagrams/index.puml!0\n      !include #{fixtures_dir}/diagrams/index.puml!1\n      alice -> bob"
    expect(preprocess(text, logger: logger)).to eq "\nA -> A : stuff1\nB -> B : stuff2\nC -> C : stuff3\nD -> D : stuff4\n      alice -> bob"
  end

  it 'resolves nested !include paths relative to the including file, not the root document' do
    text = "\n      !include #{fixtures_dir}/include/parent/child/handwritten.iuml\n      alice -> bob"
    expect(preprocess(text, logger: logger)).to eq "\nskinparam Handwritten true\nskinparam DefaultFontName \"Neucha\"\nskinparam BackgroundColor black\n      alice -> bob"
  end

  it 'inlines a file referenced by an absolute path in !include' do
    text = "\n      !include #{fixtures_dir}/include/parent/child/handwritten.iuml\n      alice -> bob"
    expect(preprocess(text, logger: logger)).to eq "\nskinparam Handwritten true\nskinparam DefaultFontName \"Neucha\"\nskinparam BackgroundColor black\n      alice -> bob"
  end

  it 'strips @startuml/@enduml wrapper tags from included file content' do
    text = <<~PLANTUML.chomp
      \n      @startuml
      alice -> bob
      @enduml

      @startuml(id="another diagram")
      here -> there
      @enduml
    PLANTUML
    result = preprocess(text, logger: logger)
    expect(result).not_to include('@startuml')
    expect(result).not_to include('@enduml')
    expect(result.strip).to eq "alice -> bob\nhere -> there"
  end

  it 'resolves !include relative to the file it was read from when used as a block macro target' do
    file = "#{File.expand_path('../../test/fixtures/docs/diagrams', __dir__)}/hello.puml"
    result = described_class.preprocess(File.read(file), file, nil, logger)
    expect(result.strip).to eq "skinparam monochrome true\n\nBob->Alice: Hello"
  end

  it 'searches kroki-plantuml-include-paths in order, falling back to later directories' do
    included = File.read("#{fixtures_dir}/include/base.iuml")
    include_paths = [File.join(fixtures_dir, 'styles'), File.join(fixtures_dir, 'include')].join(File::PATH_SEPARATOR)
    text = "!include base.iuml\nalice -> bob"
    expect(preprocess(text, include_paths: include_paths, logger: logger)).to eq "#{included}\nalice -> bob"
  end
end
