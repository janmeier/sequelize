var Utils = require('./../utils')

module.exports = (function() {
  var HasManyDoubleLinked = function(definition, instance) {
    this.__factory = definition
    this.instance = instance
  }

  HasManyDoubleLinked.prototype.injectGetter = function(options) {
    var self = this, _options = options

    var customEventEmitter = new Utils.CustomEventEmitter(function() {
      var where = {}, options = _options || {};

      //fully qualify
      where = Utils.setAttributes(where, self.__factory.identifier, self.instance, self.__factory.connectorDAO.tableName+".")

      var primaryKeys = Object.keys(self.__factory.connectorDAO.rawAttributes)
        , identifier = flattenIdentifiers.call(this, self.__factory.identifier)
        , foreignKey = primaryKeys.filter(function(pk) { 
        if(Utils.isHash(identifier)) {
          return !Utils._.any(Utils._.keys(identifier), function(elem) {
            return elem == pk
          })
        } else {
          return  pk != identifier
        }
       })[0]
        
      if (Utils.isHash(foreignKey)) {    
        Utils._.each(foreignKey, function(elem, key) {
          where[self.__factory.connectorDAO.tableName+"."+key] = {join: self.__factory.target.tableName + "." + instance.elem }
        })
      } else {
        where[self.__factory.connectorDAO.tableName+"."+foreignKey] = {join: self.__factory.target.tableName+".id"}
      }

      if (options.where) {
        Utils._.each(options.where, function(value, index) {
          delete options.where[index];
          options.where[self.__factory.target.tableName+"."+index] = value;
        });

        Utils._.extend(options.where, where)
      } else {
        options.where = where;
      }

      self.__factory.target.findAllJoin(self.__factory.connectorDAO.tableName, options)
        .on('success', function(objects) { customEventEmitter.emit('success', objects) })
        .on('error', function(err){ customEventEmitter.emit('error', err) })
        .on('sql', function(sql) { customEventEmitter.emit('sql', sql)})
    })

    return customEventEmitter.run()
  }

  HasManyDoubleLinked.prototype.injectSetter = function(emitterProxy, oldAssociations, newAssociations) {
    var self = this

    destroyObsoleteAssociations
      .call(this, oldAssociations, newAssociations)
      .on('sql', function(sql) { emitterProxy.emit('sql', sql) })
      .error(function(err) { emitterProxy.emit('error', err) })
      .success(function() {
        var chainer             = new Utils.QueryChainer
          , association         = self.__factory.target.associations[self.__factory.associationAccessor]
          , foreignIdentifier   = association.isSelfAssociation ? association.foreignIdentifier : association.identifier
          , unassociatedObjects = newAssociations.filter(function(obj) { return !obj.equalsOneOf(oldAssociations) })

        unassociatedObjects.forEach(function(unassociatedObject) {
          var attributes = {}
          
          attributes = Utils.setAttributes(attributes, self.__factory.identifier, self.instance)
          attributes = Utils.setAttributes(attributes, foreignIdentifier, unassociatedObject)

          chainer.add(self.__factory.connectorDAO.create(attributes))
        })

        chainer
          .run()
          .success(function() { emitterProxy.emit('success', newAssociations) })
          .error(function(err) { emitterProxy.emit('error', err) })
          .on('sql', function(sql) { emitterProxy.emit('sql', sql) })
      })
  }

  // private

  // takes and identifer, and returns it, if it is a plain string, or flattens it, removing type declarations if it is a hash.
  var flattenIdentifiers = function(identifier) {
    var _identifier = {}
    if (Utils.isHash(identifier)) {
      Utils._.each(identifier, function(elem, key) {
        if (Utils.isHash(elem)) {
          _identifier[key] = elem.key
        } else {
          _identifier[key] = elem
        }
      })      
      return _identifier
    } else {
      return identifier;
    }
  }
  
  var destroyObsoleteAssociations = function(oldAssociations, newAssociations) {
    var self = this

    return new Utils.CustomEventEmitter(function(emitter) {
      var chainer = new Utils.QueryChainer()
      var foreignIdentifier = self.__factory.target.associations[self.__factory.associationAccessor].identifier
      var obsoleteAssociations = oldAssociations.filter(function(obj) { return !obj.equalsOneOf(newAssociations) })

      if (obsoleteAssociations.length === 0) {
        return emitter.emit('success', null)
      }

      obsoleteAssociations.forEach(function(associatedObject) {
        var where       = {}
          , primaryKeys = Utils._.keys(self.__factory.connectorDAO.rawAttributes)
          , identifier = flattenIdentifiers.call(this, self.__factory.identifier)
          , foreignKey       = primaryKeys.filter(function(pk) { return pk != self.__factory.identifier })[0]
          , notFoundEmitters = []
          , foreignKey = primaryKeys.filter(function(pk) { 
          if(Utils.isHash(identifier)) {
            return !Utils._.any(Utils._.keys(identifier), function(elem) {
              return elem == pk
            })
            } else {
              return  pk != identifier
            }
          })[0]         
          
        where = Utils.setAttributes(where, self.__factory.identifier, self.instance)
        where = Utils.setAttributes(where, foreignKey, associatedObject)

        self.__factory.connectorDAO
          .find({ where: where })
          .success(function(connector) {
            if (connector === null) {
              notFoundEmitters.push(null)
            } else {
              chainer.add(connector.destroy())
            }

            if ((chainer.emitters.length + notFoundEmitters.length) === obsoleteAssociations.length) {
              // found all obsolete connectors and will delete them now
              chainer
                .run()
                .success(function() { emitter.emit('success', null) })
                .error(function(err) { emitter.emit('error', err) })
                .on('sql', function(sql) { emitter.emit('sql', sql) })
            }
          })
          .error(function(err) { emitter.emit('error', err) })
          .on('sql', function(sql) { emitter.emit('sql', sql) })
      })
    }).run()
  }

  return HasManyDoubleLinked
})()
