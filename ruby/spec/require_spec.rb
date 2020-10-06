# frozen_string_literal: true

describe 'require' do
  it 'should require the library' do
    lib = File.expand_path('lib', __dir__)
    $LOAD_PATH.unshift(lib) unless $LOAD_PATH.include?(lib)
    require 'asciidoctor-kroki'

    (expect Asciidoctor::Extensions.groups[:extgrp0]).to_not be_nil
  end
end
