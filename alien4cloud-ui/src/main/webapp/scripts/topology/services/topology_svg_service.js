define(function (require) {
  'use strict';

  var modules = require('modules');
  var _ = require('lodash');
  var d3Tip = require('d3-tip');
  var d3 = require('d3');

  require('scripts/common-graph/services/svg_service');
  require('scripts/common-graph/services/d3_service');
  require('scripts/common-graph/services/router_factory_service');

  require('scripts/tosca/services/tosca_service');

  require('scripts/topology/services/topology_layout_services');

  modules.get('a4c-topology-editor', ['a4c-tosca', 'a4c-common-graph']).factory('topologySvgFactory', ['svgServiceFactory', 'topologyLayoutService', 'routerFactoryService', 'toscaService', 'd3Service',
    function(svgServiceFactory, topologyLayoutService, routerFactoryService, toscaService, d3Service) {

      function TopologySvg (clickCallback, containerElement, isRuntime, nodeRenderer) {
        this.networkStyles = 10;
        this.isGridDisplayed = false;
        this.firstRender = true;

        this.setNodeRenderer(nodeRenderer);

        this.clickCallback = clickCallback;
        this.isRuntime = isRuntime;

        this.selectedNodeId = null;
        // create svg element
        this.svgGraph = svgServiceFactory.create(containerElement, 'topologySvgContainer', 'topology-svg');
        this.svg = this.svgGraph.svg;
        d3.selectAll('.d3-tip').remove();
        var instance = this;
        this.tip = d3Tip().attr('class', 'd3-tip').html(function(node) {
          var nodeTemplate = instance.topology.topology.nodeTemplates[node.id];
          var nodeType = instance.topology.nodeTypes[nodeTemplate.type];
          return instance.tooltip(node, nodeTemplate, nodeType);
        });
        this.svg.call(this.tip);

        this.defineMarkers(this.svg);
      }

      TopologySvg.prototype = {
        constructor: TopologySvg,

        onResize: function(dimensions) {
          this.svgGraph.onResize(dimensions.width, dimensions.height);
          this.svgGraph.controls.coordinateUtils.reset();
          this.svgGraph.controls.updateViewBox();
        },

        checkBrowser: function(browserName) {
          return navigator.userAgent.indexOf(browserName) !== -1;
        },

        setNodeRenderer: function(nodeRenderer) {
          if(this.nodeRenderer === nodeRenderer) {
            return;
          }
          if(_.defined(this.svg)) {
            this.svg.selectAll('.node-template').remove();
          }
          this.nodeRenderer = nodeRenderer;
          var minDistance = this.nodeRenderer.distanceBetweenNodeHorizontal < this.nodeRenderer.distanceBetweenNodeVertical ? this.nodeRenderer.distanceBetweenNodeHorizontal : this.nodeRenderer.distanceBetweenNodeVertical;
          this.gridStep = minDistance / 4;
          this.reset(this.topology);
        },

        reset: function(topology) {
          var i, layout;

          this.topology = topology;

          if (!_.defined(this.topology)) {
            return;
          }

          // Compute the automatic layout for the topology.
          var nodeRenderer = this.nodeRenderer;
          var nodeSize = {
            width: nodeRenderer.width,
            height: nodeRenderer.height
          };
          var spacing = {
            rootBranch: {x: nodeRenderer.distanceBetweenBranchHorizontal},
            branch: {x: nodeRenderer.distanceBetweenNodeHorizontal, y: nodeRenderer.distanceBetweenNodeVertical},
            node: {y: nodeRenderer.distanceBetweenNodeVertical},
            network: 14
          };

          layout = topologyLayoutService.layout(topology.topology.nodeTemplates, topology.nodeTypes, topology.relationshipTypes, nodeSize,
            spacing);
          // Update connector routing.
          this.grid = routerFactoryService.create(layout.bbox, this.gridStep);
          for(i = 0; i< layout.nodes.length;i++) {
            this.grid.addObstacle(layout.nodes[i].bbox);
          }
          for(i = 0; i< layout.links.length;i++) {
            this.computeLinkRoute(layout.links[i]);
          }

          this.layout = layout;
          // draw the svg
          this.draw(layout);
          this.displayGrid();

          this.svgGraph.controls.coordinateUtils.bbox = layout.bbox;

          this.svgGraph.controls.coordinateUtils.reset();
          this.svgGraph.controls.updateViewBox();
        },

        computeLinkRoute: function(link) {
          // compute the route path
          var route;
          if(link.isNetwork) {
            route = [];
          } else {
            route = this.grid.route(link.source, link.source.direction, link.target, link.target.direction);
          }
          route.unshift(link.source);
          route.push(link.target);
          link.route = route;
        },

        displayGrid: function() {
          if(!this.isGridDisplayed) {
            return;
          }
          for (var i = 0; i < this.grid.cells.length; i++) {
            for (var j = 0; j < this.grid.cells[i].length; j++) {
              var rect = d3Service.rect(this.svg, this.grid.bbox.minX + i * this.gridStep, this.grid.bbox.minY + j * this.gridStep, this.gridStep - 1, this.gridStep - 1, 0, 0, null).style('fill-opacity', 0.3);
              if (this.grid.cells[i][j].visited === 1) {
                rect.style('fill', 'green');
              } else if (this.grid.cells[i][j].weight === 0) {
                rect.style('fill', 'blue');
              } else {
                rect.style('fill', 'red');
              }
            }
          }
        },

        draw: function(layout) {
          var instance = this;

          var nodes = layout.nodes;
          var links = layout.links;

          // remove the group bullets
          var nodeGroupSelection = this.svg.selectAll('.node-template-group');
          nodeGroupSelection.remove();

          var nodeSelection = this.svg.selectAll('.node-template').data(nodes, function(node) { return node.id; });

          // update existing nodes
          nodeSelection.each(function(node) {
            var nodeGroup = d3.select(this);
            instance.updateNode(nodeGroup, node);
          });

          // create new nodes
          var newNodeGroups = nodeSelection.enter().append('g').attr('class', 'node-template');
          newNodeGroups.each(function(node) {
            var nodeGroup = d3.select(this);
            instance.createNode(nodeGroup, node);
            instance.updateNode(nodeGroup, node);
          });

          // remove destroyed nodes.
          nodeSelection.exit().remove();

          this.drawLink(this.svg, links);
        },

        createNode: function(nodeGroup, node) {
          var nodeTemplate = this.topology.topology.nodeTemplates[node.id];
          var nodeType = this.topology.nodeTypes[nodeTemplate.type];
          var oX = -(this.nodeRenderer.width / 2);
          var oY = -(this.nodeRenderer.height / 2);

          var instance = this;
          var onclick = function() {
            // un-select last node and select the new one on click
            instance.clickCallback({
              'newSelectedName': node.id,
              'oldSelectedName': instance.selectedNodeId
            });

            instance.selectedNodeId = node.id;
          };

          d3Service.rect(nodeGroup, oX, oY, this.nodeRenderer.width, this.nodeRenderer.height, 0, 0).attr('class', 'background');

          this.nodeRenderer.createNode(nodeGroup, node, nodeTemplate, nodeType, oX, oY);
          // specific to networks
          if (toscaService.isOneOfType(['tosca.nodes.Network'], nodeTemplate.type, this.topology.nodeTypes)) {
            var netX = oX + this.nodeRenderer.width;
            var netMaxX = netX + this.layout.bbox.width() - this.nodeRenderer.width;
            var netY = oY + (this.nodeRenderer.height/2) - 2;
            var netStyle = node.networkId % this.networkStyles;
            var path = 'M '+netX+','+netY+' '+netMaxX+','+netY;
            nodeGroup.append('path').attr('d', path).attr('class', 'link-network link-network-' + netStyle + ' link-selected');
          }

          d3Service.rect(nodeGroup, oX, oY, this.nodeRenderer.width, this.nodeRenderer.height, 0, 0).attr('class', 'selector').attr('node-template-id', node.id)
            .attr('id', 'rect_' + node.id).on('click', onclick).on('mouseover', this.tip.show).on('mouseout', this.tip.hide);
        },

        updateNode: function(nodeGroup, node) {
          var oX = -(this.nodeRenderer.width / 2);
          var oY = -(this.nodeRenderer.height / 2);
          var nodeTemplate = this.topology.topology.nodeTemplates[node.id];
          var nodeType = this.topology.nodeTypes[nodeTemplate.type];
          var instance = this;

          // update location
          nodeGroup.attr('transform', function(d) {
            return 'translate(' + d.coordinate.x + ',' + d.coordinate.y + ')';
          });

          // update background class
          nodeGroup.classed('selected', function(){ return nodeTemplate.selected; });

          this.nodeRenderer.updateNode(nodeGroup, node, nodeTemplate, nodeType, oX, oY, this.topology);

          var scalingPolicySelection = null;
          var scalingPolicy = toscaService.getScalingPolicy(nodeTemplate);

          if (toscaService.isOneOfType(['tosca.nodes.Network'], nodeTemplate.type, this.topology.nodeTypes)) {
            var netX = oX + this.nodeRenderer.width;
            var netMaxX = netX + this.layout.bbox.width() - this.nodeRenderer.width;
            var netY = oY + (this.nodeRenderer.height/2) - 2;
            var path = 'M '+netX+','+netY+' '+netMaxX+','+netY;
            nodeGroup.select('.link-network').attr('d', path);
          }

          if(_.defined(scalingPolicy)) {
            scalingPolicySelection = nodeGroup.select('#scalingPolicy');
            if(scalingPolicySelection.empty()) {
              var scalingPolicyGroup = nodeGroup.append('g').attr('id', 'scalingPolicy');
              scalingPolicyGroup.append('circle').attr('cx', oX + this.nodeRenderer.width).attr('cy', oY).attr('r', '12').attr('class', 'topology-svg-icon-circle');
              scalingPolicyGroup.append('text').attr('class', 'topology-svg-icon topology-svg-icon-center').attr('x', oX + this.nodeRenderer.width).attr('y', oY)
                .attr('transform', 'rotate(90 '+(oX + this.nodeRenderer.width)+' '+oY+')')
                .text(function() { return '\uf112'; });
            }
          } else {
            scalingPolicySelection = nodeGroup.select('#scalingPolicy');
            if(!scalingPolicySelection.empty()) {
              scalingPolicySelection.remove();
            }
          }

        },

        tooltip: function (node) {
          var nodeTemplate = this.topology.topology.nodeTemplates[node.id];
          var nodeType = this.topology.nodeTypes[nodeTemplate.type];

          return this.nodeRenderer.tooltip(node, nodeTemplate, nodeType);
        },

        drawLink: function(parent, links) {
          var instance = this;

          var topology = this.topology;

          var linkSelection = parent.selectAll('.link').data(links, function(link) { return link.id; });

          var newLinks = linkSelection.enter().append('path');
          newLinks.each(function(link) {
            var linkPath = d3.select(this);
            if(link.isNetwork) {
              var netStyle = link.networkId % instance.networkStyles;
              linkPath.attr('class', 'link link-network link-network-' + netStyle);
            } else {
              linkPath.attr('class', 'link');
              var isHostedOn = toscaService.isHostedOnType(link.type, topology.relationshipTypes);
              linkPath.classed('link-hosted-on', function() { return isHostedOn; })
                .classed('link-depends-on', function() { return !isHostedOn; })
                .attr('marker-start', function(link) {
                  return toscaService.isHostedOnType(link.type, topology.relationshipTypes) ? 'url(#markerHosted)' : 'url(#markerDepends)';
                }).attr('marker-end', function(link) {
                  return toscaService.isHostedOnType(link.type, topology.relationshipTypes) ? 'url(#markerHostedTarget)' : 'url(#markerDependsEnd)';
                });
            }
            instance.drawLinkPath(linkPath);
          });

          linkSelection.each(function() {
            var linkPath = d3.select(this);
            instance.drawLinkPath(linkPath);
          });
          linkSelection.exit().remove();
        },

        drawLinkPath: function(linkPath) {
          linkPath.attr('d', function(link) {
              // compute the route path
              var route = link.route;
              var path = 'M' + route[0].x + ',' + route[0].y;
              for (var i = 1; i < route.length - 1; i++) {
                path = path + ' ' + route[i].x + ',' + route[i].y;
              }
              path = path + ' ' + route[route.length - 1].x + ',' + route[route.length - 1].y;

              return path;
            });
          linkPath.classed('link-selected', function(link) { return link.selected; });
        },

        defineMarkers: function(svg) {
          var defs = svg.append('defs');
          defs.append('marker')
            .attr('id', 'markerDepends')
            .attr('markerUnits', 'userSpaceOnUse')
            .attr('markerWidth', '14')
            .attr('markerHeight', '14')
            .attr('refX', '0')
            .attr('refY', '7')
            .append('path')
            .attr('d', 'M 3,12 0,12 0,2 3,2 10,7 z')
            .attr('orient', 'auto').attr('style', 'stroke: none; fill: #048204');
          defs.append('marker')
            .attr('id', 'markerDependsEnd')
            .attr('markerUnits', 'userSpaceOnUse')
            .attr('markerWidth', '14')
            .attr('markerHeight', '14')
            .attr('refX', '12')
            .attr('refY', '7')
            .append('path')
            .attr('d', 'M 0,12 12,12 12,2 0,2 7,7 z')
            .attr('orient', 'auto').attr('style', 'stroke: none; fill: #048204');
          defs.append('marker')
            .attr('id', 'markerHosted')
            .attr('markerUnits', 'userSpaceOnUse')
            .attr('markerWidth', '14')
            .attr('markerHeight', '14')
            .attr('refX', '12')
            .attr('refY', '7')
            .append('path')
            .attr('d', 'M 9,12 12,12 12,2 9,2 2,7 z')
            .attr('orient', 'auto').attr('style', 'stroke: none; fill: #0000FF');
          defs.append('marker')
            .attr('id', 'markerHostedTarget')
            .attr('markerUnits', 'userSpaceOnUse')
            .attr('markerWidth', '14')
            .attr('markerHeight', '14')
            .attr('refX', '7')
            .attr('refY', '12')
            .append('path')
            .attr('d', 'M 12,0 12,12 2,12 2,0 7,7 z')
            .attr('orient', 'auto').attr('style', 'stroke: none; fill: #0000FF');
        }
      };

      return {
        create: function(clickCallback, containerElement, isRuntime, nodeRenderer) {
          return new TopologySvg(clickCallback, containerElement, isRuntime, nodeRenderer);
        }
      };
    } // function
  ]); // factory
}); // define