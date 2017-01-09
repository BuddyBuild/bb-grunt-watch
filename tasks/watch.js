/*
 * grunt-contrib-watch
 * http://gruntjs.com/
 *
 * Copyright (c) 2016 "Cowboy" Ben Alman, contributors
 * Licensed under the MIT license.
 */

'use strict';

var path = require('path');
var Watchman = require('fb-watchman');
var _ = require('lodash');
var waiting = 'Waiting...';
var changedFiles = Object.create(null);
var watchers = [];

module.exports = function(grunt) {

  var taskrun = require('./lib/taskrunner')(grunt);

  // Default date format logged
  var dateFormat = function(time) {
    grunt.log.writeln(String(
      'Completed in ' +
      time.toFixed(3) +
      's at ' +
      (new Date()).toString()
    ).cyan + ' - ' + waiting);
  };

  // When task runner has started
  taskrun.on('start', function() {
    Object.keys(changedFiles).forEach(function(filepath) {
      // Log which file has changed, and how.
      grunt.log.ok('File "' + filepath + '" ' + changedFiles[filepath] + '.');
    });
    // Reset changedFiles
    changedFiles = Object.create(null);
  });

  // When task runner has ended
  taskrun.on('end', function(time) {
    if (time > 0) {
      dateFormat(time);
    }
  });

  // When a task run has been interrupted
  taskrun.on('interrupt', function() {
    grunt.log.writeln('').write('Scheduled tasks have been interrupted...'.yellow);
  });

  // When taskrun is reloaded
  taskrun.on('reload', function() {
    taskrun.clearRequireCache(Object.keys(changedFiles));
    grunt.log.writeln('').writeln('Reloading watch config...'.cyan);
  });

  grunt.registerTask('bbwatch', 'Run predefined tasks whenever watched files change.', function(target) {
    var self = this;
    var name = self.name || 'bbwatch';

    // Close any previously opened watchers
    watchers.forEach(function(watcher) {
      watcher.end();
    });
    watchers = [];

    // Never gonna give you up, never gonna let you down
    if (grunt.config([name, 'options', 'forever']) !== false) {
      taskrun.forever();
    }

    // If a custom dateFormat function
    var df = grunt.config([name, 'options', 'dateFormat']);
    if (typeof df === 'function') {
      dateFormat = df;
    }

    if (taskrun.running === false) { grunt.log.writeln(waiting); }

    // initialize taskrun
    var targets = taskrun.init(name, {});
    // Create watcher per target
    const watchman = new Watchman.Client();
    watchers.push(watchman);

    const subscriptions = {};
    watchman.command(['watch-project', process.cwd()], (err, rsp) => {

        watchman.command(['clock', rsp.watch], (err, clockRsp) => {

          targets.forEach(function(target, i) {

              target.subscription.since = clockRsp.clock;
              if (!target.subscription.fields) {
                target.subscription.fields = ["name", "size", "mtime_ms", "exists", "type"];
              }

              // On changed/added/deleted
              watchman.command(['subscribe', rsp.watch, target.name, target.subscription], (e, r) => {
                subscriptions[target.name] = target;
              });
          });

        });

        watchman.on('subscription', resp => {

            const target = subscriptions[resp.subscription];
            const status = 'changed';

            resp.files.forEach(file => {
              let filepath = file.name;
              // Skip events not specified
              if (!_.includes(target.options.event, 'all') &&
                  !_.includes(target.options.event, status)) {
                return;
              }

              filepath = path.relative(process.cwd(), filepath);

              // Skip empty filepaths
              if (filepath === '') {
                return;
              }

              // If Gruntfile.js changed, reload self task
              if (target.options.reload || /gruntfile\.(js|coffee)/i.test(filepath)) {
                taskrun.reload = true;
              }

              // Emit watch events if anyone is listening
              if (grunt.event.listeners('watch').length > 0) {
                grunt.event.emit('watch', status, filepath, target.name);
              }

              // Group changed files only for display
              changedFiles[filepath] = status;

              // Add changed files to the target
              if (taskrun.targets[target.name]) {
                if (!taskrun.targets[target.name].changedFiles) {
                  taskrun.targets[target.name].changedFiles = Object.create(null);
                }
                taskrun.targets[target.name].changedFiles[filepath] = status;
              }

              // Queue the target
              if (taskrun.queue.indexOf(target.name) === -1) {
                taskrun.queue.push(target.name);
              }

              // Run the tasks
              taskrun.run();

            });

        });
    });

  });
};
