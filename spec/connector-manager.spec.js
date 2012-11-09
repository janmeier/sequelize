if(typeof require === 'function') {
  const buster             = require("buster")
      , Helpers            = require('./buster-helpers')
      , dialect            = Helpers.getTestDialect();
}

buster.spec.expose();
buster.testRunner.timeout = 5000;

describe("[" + dialect.toUpperCase() + "] ConnectorManager", function() {
  before(function(done) {
    var self = this;

    Helpers.initTests({
      dialect: dialect,
      beforeComplete: function(sequelize, DataTypes) {
        self.sequelize = sequelize;
        self.User      = sequelize.define('User', {
          username:  { type: DataTypes.STRING }
        });
      },
      onComplete: function() {
        self.User.sync({ force: true }).success(function () {
          self.User.create({username: 'user1'}).success(done);
        });
      }
    });
  });

  it('works correctly after being idle', function(done) {
    var self = this;

    this.User.count().on('success', function(count) {
      expect(count).toEqual(1);
    });

    setTimeout(function() {
      self.User.count().on('success', function(count) {
        expect(count).toEqual(1);
        done();
      });
    }, 1000);
  });
});