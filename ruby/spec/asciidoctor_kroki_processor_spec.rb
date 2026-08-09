# frozen_string_literal: true

require 'rspec_helper'
require 'asciidoctor'
require_relative '../lib/asciidoctor/extensions/asciidoctor_kroki'

describe '::AsciidoctorExtensions::KrokiProcessor' do
  it 'should return the images output directory (imagesoutdir attribute)' do
    doc = Asciidoctor.load('hello', attributes: { 'imagesoutdir' => '.asciidoctor/kroki/images', 'imagesdir' => '../images' })
    output_dir_path = AsciidoctorExtensions::KrokiProcessor.send(:output_dir_path, doc)
    expect(output_dir_path).to eq '.asciidoctor/kroki/images'
  end
  it 'should return a path relative to output directory (to_dir option)' do
    doc = Asciidoctor.load('hello', to_dir: '.asciidoctor/kroki/relative', attributes: { 'imagesdir' => '../images' })
    output_dir_path = AsciidoctorExtensions::KrokiProcessor.send(:output_dir_path, doc)
    expect(output_dir_path).to eq '.asciidoctor/kroki/relative/../images'
  end
  it 'should return a path relative to output directory (outdir attribute)' do
    doc = Asciidoctor.load('hello', attributes: { 'imagesdir' => 'resources/images', 'outdir' => '.asciidoctor/kroki/out' })
    output_dir_path = AsciidoctorExtensions::KrokiProcessor.send(:output_dir_path, doc)
    expect(output_dir_path).to eq '.asciidoctor/kroki/out/resources/images'
  end
  it 'should return a path relative to the base directory (base_dir option)' do
    doc = Asciidoctor.load('hello', base_dir: '.asciidoctor/kroki', attributes: { 'imagesdir' => 'img' })
    output_dir_path = AsciidoctorExtensions::KrokiProcessor.send(:output_dir_path, doc)
    expect(output_dir_path).to eq "#{Dir.pwd}/.asciidoctor/kroki/img"
  end
  it 'should return a path relative to the base directory (default value is current working directory)' do
    doc = Asciidoctor.load('hello', attributes: { 'imagesdir' => 'img' })
    output_dir_path = AsciidoctorExtensions::KrokiProcessor.send(:output_dir_path, doc)
    expect(output_dir_path).to eq "#{Dir.pwd}/img"
  end
  it 'should compute an imagesdir override pointing at imagesoutdir when it diverges from to_dir (#373)' do
    doc = Asciidoctor.load('hello', to_dir: '.asciidoctor/kroki/relative', attributes: { 'imagesoutdir' => '.asciidoctor/kroki/images' })
    images_output_dir = AsciidoctorExtensions::KrokiProcessor.send(:output_dir_path, doc)
    imagesdir = AsciidoctorExtensions::KrokiProcessor.send(:relative_images_dir, doc, images_output_dir)
    expect(imagesdir).to eq '../images'
  end
  it 'should compute an imagesdir override that is a no-op when imagesoutdir is not set' do
    doc = Asciidoctor.load('hello', attributes: { 'imagesdir' => 'img' })
    images_output_dir = AsciidoctorExtensions::KrokiProcessor.send(:output_dir_path, doc)
    imagesdir = AsciidoctorExtensions::KrokiProcessor.send(:relative_images_dir, doc, images_output_dir)
    expect(imagesdir).to eq 'img'
  end
  it 'should return the option defined on the block' do
    doc = Asciidoctor.load('hello')
    option = AsciidoctorExtensions::KrokiProcessor.send(:get_option, { 'inline-option' => '' }, doc)
    expect(option).to eq 'inline'
  end
  it 'should fall back to the kroki-default-options document attribute' do
    doc = Asciidoctor.load('hello', attributes: { 'kroki-default-options' => 'inline' })
    option = AsciidoctorExtensions::KrokiProcessor.send(:get_option, {}, doc)
    expect(option).to eq 'inline'
  end
  it 'should let the block option override the kroki-default-options document attribute' do
    doc = Asciidoctor.load('hello', attributes: { 'kroki-default-options' => 'inline' })
    option = AsciidoctorExtensions::KrokiProcessor.send(:get_option, { 'none-option' => '' }, doc)
    expect(option).to eq 'none'
  end
  it 'should return nil when no option is defined' do
    doc = Asciidoctor.load('hello')
    option = AsciidoctorExtensions::KrokiProcessor.send(:get_option, {}, doc)
    expect(option).to be_nil
  end
  it 'should use 4000 as the default max URI length' do
    doc = Asciidoctor.load('hello')
    expect(AsciidoctorExtensions::KrokiProcessor.send(:max_uri_length, doc)).to eq 4000
  end
  it 'should use a custom max URI length' do
    doc = Asciidoctor.load('hello', attributes: { 'kroki-max-uri-length' => '8000' })
    expect(AsciidoctorExtensions::KrokiProcessor.send(:max_uri_length, doc)).to eq 8000
  end
  it 'should fall back to 4000 when kroki-max-uri-length is not a number' do
    doc = Asciidoctor.load('hello', attributes: { 'kroki-max-uri-length' => 'not-a-number' })
    expect(AsciidoctorExtensions::KrokiProcessor.send(:max_uri_length, doc)).to eq 4000
  end
end
