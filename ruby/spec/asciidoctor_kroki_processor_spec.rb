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
end
