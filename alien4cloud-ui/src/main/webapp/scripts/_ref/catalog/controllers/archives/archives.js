// archive list is the entry point for browsing and managing csar archives in a4c
define(function (require) {
  'use strict';

  var states = require('states');

  require('scripts/_ref/catalog/controllers/archives/csar_list');

  // register archives management state
  states.state('catalog.archives', {
    url: '/archives',
    template: '<ui-view/>',
    menu: {
      id: 'catalog.archives',
      state: 'catalog.archives',
      key: 'NAVCATALOG.MANAGE_ARCHIVES',
      // icon: 'fa fa-archive',
      priority: 10,
    }
  });
  states.forward('catalog.archives', 'catalog.archives.list');
});
