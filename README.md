# bb-grunt-watch

A version of [grunt-contrib-watch](https://github.com/gruntjs/grunt-contrib-watch) that uses the [Watchman](https://facebook.github.io/watchman/) file monitoring service, instead of relying on the Node file-watching primitives.

The grunt task is called **bbwatch**.

The task options looks something like the following:

            injectCss: {
                subscription: {
                    expression:
                    ['anyof',
                        ['match', 'client/app/**/*.css', 'wholename'],
                        ['match', 'client/components/**/*.css', 'wholename']
                    ]
                },
                tasks: ['injector:css']
            }


The **subscription** parameter defines the [Watchman subscription](https://facebook.github.io/watchman/docs/cmd/subscribe.html) that must be matched for the tasks to run.  Note that the *fields* parameter is optional and will be provided to match all changes, if not supplied.

The **tasks** parameter defines which grunt tasks are run.
