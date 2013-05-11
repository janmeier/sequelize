var Utils     = require("./../utils")
  , DataTypes = require('./../data-types')
  , Helpers   = require("./helpers")

module.exports = (function() {
  var HasOne = function(srcDAO, targetDAO, options) {
    this.associationType   = 'HasOne'
    this.source            = srcDAO
    this.target            = targetDAO
    this.options           = options
    this.isSelfAssociation = (this.source.tableName == this.target.tableName)

    if (this.isSelfAssociation && !this.options.foreignKey && !!this.options.as) {
      this.options.foreignKey = Utils._.underscoredIf(Utils.singularize(this.options.as) + "Id", this.options.underscored)
    }

    this.associationAccessor = this.isSelfAssociation
      ? Utils.combineTableNames(this.target.tableName, this.options.as || this.target.tableName)
      : this.options.as || this.target.tableName

    this.accessors = {
      get: Utils._.camelize('get_' + (this.options.as || Utils.singularize(this.target.tableName))),
      set: Utils._.camelize('set_' + (this.options.as || Utils.singularize(this.target.tableName)))
    }
  }

  // the id is in the target table
  HasOne.prototype.injectAttributes = function() {
    var newAttributes = {},
      self = this

    this.identifier = this.options.foreignKey || Utils._.underscoredIf(Utils.singularize(this.source.tableName) + "Id", this.options.underscored)

    if(Utils.isHash(this.identifier)) {
       Utils._.each(this.identifier, function(elem, key) {
        newAttributes[key] = self.identifier[key].type || DataTypes.INTEGER
        Helpers.addForeignKeyConstraints(newAttributes[key], this.source, this.target, this.options)
      }, this)
    } else {
      newAttributes[this.identifier] = { type: DataTypes.INTEGER }
      Helpers.addForeignKeyConstraints(newAttributes[this.identifier], this.source, this.target, this.options)
    }
    
    Utils._.defaults(this.target.rawAttributes, newAttributes)
    // Sync attributes to DAO proto each time a new assoc is added
    this.target.DAO.prototype.attributes = Object.keys(this.target.DAO.prototype.rawAttributes);

    return this
  }

  HasOne.prototype.injectGetter = function(obj) {
    var self = this;

    obj[this.accessors.get] = function(params) {
      var where = Utils.setAttributes({}, self.identifier, this)
      
      if (!Utils._.isUndefined(params)) {
        if (!Utils._.isUndefined(params.attributes)) {
          params = Utils._.extend({where: where}, params)
        }
      } else {
        params = {where: where}
      }

      return self.target.find(params);
    };
    obj[this.accessors.get+'FindParams'] = function() {
      return {where: Utils.setAttributes({}, self.identifier, this)};
    };

    return this;
  };

  HasOne.prototype.injectSetter = function(obj) {
    var self    = this
      , options = this.options || {}

    obj[this.accessors.set] = function(associatedObject) {
      var instance = this;
      return new Utils.CustomEventEmitter(function(emitter) {
        instance[self.accessors.get]().success(function(oldObj) {
          if(oldObj) {
            oldObj = Utils.setAttributes(oldObj, self.identifier, options.omitNull ? '' : null)
            oldObj.save()
          }

          if(associatedObject) {
            associatedObject = Utils.setAttributes(associatedObject, self.identifier, instance)
            associatedObject
              .save()
              .success(function() { emitter.emit('success', associatedObject) })
              .error(function(err) { emitter.emit('error', err) })
          } else {
            emitter.emit('success', null)
          }          
        })
      }).run()
    }

    return this
  }

  return HasOne
})()
