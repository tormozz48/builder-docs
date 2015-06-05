var fs = require('fs'),
    mockFs = require('mock-fs'),
    should = require('should'),
    Config = require('bs-builder-core/lib/config'),
    Model = require('bs-builder-core/lib/model/model'),
    Github = require('../../lib/github'),
    DocsLoadGh = require('../../lib/tasks/docs-gh-load');

describe('DocsLoadGh', function () {
    it('should return valid task name', function () {
       DocsLoadGh.getName().should.equal('docs load from gh');
    });

    it('should return valid gh url pattern', function () {
        should.deepEqual(DocsLoadGh.getGhUrlPattern(),
            /^https?:\/\/(.+?)\/(.+?)\/(.+?)\/(tree|blob)\/(.+?)\/(.+)/);
    });

    describe('instance methods', function () {
        var config,
            task;

        before(function () {
            var token = [
                '92c5', 'a62f', '7ae4', '4c16', '40ed',
                '1195', 'd448', '4689', '669c', '5caa'
            ].join('')

            config = new Config('debug');
            task = new DocsLoadGh(config, { token: token });
        });

        describe('_getContentFromGh', function () {
            it('should get valid content of file from gh', function (done) {
                task._getContentFromGh({
                    host: 'github.com',
                    user: 'bem',
                    repo: 'bem-method',
                    ref:  'bem-info-data',
                    path: 'method/index/index.en.md'
                }, null).then(function (result) {
                    result.should.be.instanceOf(Object);
                    done();
                });
            });

            it('should return rejected promise in case of invalid repo info', function (done) {
                task._getContentFromGh({
                    host: 'github.com',
                    user: 'bem',
                    repo: 'bem-method',
                    ref:  'bem-info-data',
                    path: 'method/index/invalid-path'
                }, null).catch(function (error) {
                    error.should.be.ok;
                    done();
                });
            });
        });

        describe('processPage', function () {
            var model,
                languages = ['en', 'ru'],
                page = {
                    url: '/url1',
                    en: {
                        title: 'foo bar',
                        sourceUrl: 'https://github.com/bem/bem-method/tree/bem-info-data/method/index/index.en.md'
                    },
                    ru: {}
                };

            before(function () {
                mockFs({
                    '.builder': {
                        cache: {
                            url1: {}
                        }
                    }
                });
            });

            beforeEach(function () {
                model = new Model();
            });

            after(function () {
                mockFs.restore();
            });

            it('should load file from gh and place it to cache at first time', function (done) {
                task.processPage(model, page, languages).then(function () {
                    model.getChanges().pages.added.should.be.instanceOf(Array).and.have.length(1);
                    model.getChanges().pages.modified.should.be.instanceOf(Array).and.have.length(0);
                    should.deepEqual(model.getChanges().pages.added,
                        [{ type: 'doc', url: '/url1', title: 'foo bar' }]);
                    page['en'].contentFile.should.equal('/url1/en.md');
                    fs.existsSync('.builder/cache/url1/en.json').should.equal(true);
                    fs.existsSync('.builder/cache/url1/en.md').should.equal(true);
                    done();
                });
            });

            it('should load cached file on the next verification', function (done) {
                task.processPage(model, page, languages).then(function () {
                    model.getChanges().pages.added.should.be.instanceOf(Array).and.have.length(0);
                    model.getChanges().pages.modified.should.be.instanceOf(Array).and.have.length(0);
                    done();
                });
            });

            it('should load cached file if etag was changed but sha sum are equal', function (done) {
                var p = './.builder/cache/url1/en.json',
                    o = { encoding: 'utf-8' },
                    cache = fs.readFileSync(p, o);
                cache = JSON.parse(cache);
                cache.etag = cache.etag + 'a';
                fs.writeFileSync(p, JSON.stringify(cache, null, 4), o);

                task.processPage(model, page, languages).then(function () {
                    model.getChanges().pages.added.should.be.instanceOf(Array).and.have.length(0);
                    model.getChanges().pages.modified.should.be.instanceOf(Array).and.have.length(0);
                    done();
                });
            });

            it('should reload file if sha sum was changed', function (done) {
                var p = './.builder/cache/url1/en.json',
                    o = { encoding: 'utf-8' },
                    cache = fs.readFileSync(p, o);
                cache = JSON.parse(cache);
                cache.sha = cache.sha + 'a';
                fs.writeFileSync(p, JSON.stringify(cache, null, 4), o);

                task.processPage(model, page, languages).then(function () {
                    model.getChanges().pages.added.should.be.instanceOf(Array).and.have.length(0);
                    model.getChanges().pages.modified.should.be.instanceOf(Array).and.have.length(1);
                    should.deepEqual(model.getChanges().pages.modified,
                        [{ type: 'doc', url: '/url1', title: 'foo bar' }]);
                    done();
                });
            });
        });
    });
});

