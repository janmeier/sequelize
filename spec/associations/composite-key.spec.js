if(typeof require === 'function') {
  const buster    = require("buster")
      , Sequelize = require("../../index")
      , config    = require("../config/config")
      , sequelize = new Sequelize(config.database, config.username, config.password, {logging: false})
}

buster.spec.expose()
buster.testRunner.timeout = 500

describe('Composite keys', function() {
  before(function(done) {
    var self = this

    sequelize
      .getQueryInterface()
      .dropAllTables()
      .success(function() {
        done()
      })
      .error(function(err) { console.log(err) })
  }),

  describe('using hasOne', function() {
    before(function(done) {
      var self = this
      
      this.Article = sequelize.define('Article', {
        'title': Sequelize.STRING
      }, {
        instanceMethods: {
          item_key: 'article'
        }        
      })
      this.State = sequelize.define('State', {
        'deleted': Sequelize.INTEGER,
        'story_id': Sequelize.INTEGER,
        'type': Sequelize.STRING
      })
      this.Article.hasOne(this.State, { foreignKey: { "story_id": "id", "type": {
        type: Sequelize.STRING,
        key: "item_key" 
      }}})
      
      this.Article.sync({ force: true }).success(function() {
        self.State.sync({ force: true }).success(done).error(function(err) {
          console.log(err)
        })
      }).error(function(err) {
        console.log(err)
      })
    }),
    
    describe('methods work as expected', function() {
      it('getState', function(done) {
        var self = this
      
        this.Article.create({
          title: 'An article'
        }).success(function(art) {
          self.State.create({
            deleted: 0,
            story_id: art.id,
            type: 'article'
          }).success(function(state) {
            art.getState().success(function(articleState) {
              expect(state.id).toEqual(articleState.id)
              done()
            })
          })
        })
      }),
      
      it('setState', function(done) {        
        var self = this
        
        this.Article.create({
          title: 'An article'
        }).success(function(art) {
          self.State.create({
            deleted: 0,
            story_id: 0,
            type: ''
          }).success(function(state) {
            art.setState(state).success(function(articleState) {
              expect(state.id).toEqual(articleState.id)
              expect(state.type).toEqual('article')
              expect(state.story_id).toEqual(art.id)
              done()
            })
          })
        })
      }),
      
      it('removeState', function(done) {
        var self = this
      
        this.Article.create({
          title: 'An article'
        }).success(function(art) {
          self.State.create({
            deleted: 0,
            story_id: art.id,
            type: 'article'
          }).success(function(state1) {
            self.State.create({
              deleted: 0,
              story_id: 0,
              type: ''
            }).success(function(state2) {
              art.setState(state2).success(function(articleState) {
                expect(state2.id).toEqual(articleState.id)
                expect(state1.id).not.toEqual(articleState.id)
                
                self.State.find(state1.id).success(function(s1) {
                  expect(s1.story_id).not.toEqual(art.id)
                  expect(s1.type).not.toEqual('article')
                  
                  done()
                })
              })
            })
          })
        })
      })
    })
  })
  
  describe('using hasMany', function() {
    before(function(done) {
      var self = this
      
      this.Article = sequelize.define('Article', {
        'title': Sequelize.STRING
      }, {
        instanceMethods: {
          item_key: 'article'
        }        
      })
      this.Label = sequelize.define('Label', {
        'text': Sequelize.STRING
      })
      
      this.Label.hasMany(this.Article, {foreignKey: "label_id", joinTableName: "item_label" });
      this.Article.hasMany(this.Label, {foreignKey:{ "item_id": "id", "item": "item_key" }, joinTableName: "item_label" });
      
      this.Article.sync({ force: true }).success(function() {
        self.Label.sync({ force: true }).success(done).error(function(err) {
          console.log(err)
        })
      }).error(function(err) {
        console.log(err)
      })
    }),
    
    describe('join table is created properly', function() {
      it('adds the correct attributes', function(done) {
        var daos = sequelize.daoFactoryManager.daos.filter(function(dao) {
          return (dao.tableName == 'item_labels')
        })
        
        expect(daos.length).toEqual(1)

        daos.forEach(function(dao) {
          expect(dao.attributes.label_id).toBeDefined()
          expect(dao.attributes.item_id).toBeDefined()
          expect(dao.attributes.item).toBeDefined()
        })
        done()
      })
    })

    describe('methods work as expected', function() {
      it('addLabel', function(done) {
        var self = this
        
        this.Article.create({
          title: 'An article'
        }).success(function(art) {
          art.getLabels().success(function(labels) {
            expect(labels.length).toEqual(0)
            
            self.Label.create({
              text: 'AWESOMENESS'
            }).success(function(label1) {
              self.Label.create({
                text: 'CUTENESS OVERLOAD'
              }).success(function(label2) {
                art.addLabel(label1).success(function() {
                  art.addLabel(label2).success(function() {
                    art.getLabels().success(function(labels) {
                      expect(labels.length).toEqual(2)
                      
                      done()
                    })
                  })
                })
              })
            })
          })
        })
      }),
      
      it('properly removes labels', function(done) {
        var self = this
        
        this.Article.create({
          title: 'An article'
        }).success(function(art) {
          self.Label.create({
            text: 'AWESOMENESS'
          }).success(function(label1) {
            self.Label.create({
              text: 'CUTENESS OVERLOAD'
            }).success(function(label2) {
              art.addLabel(label1).success(function() {
                art.addLabel(label2).success(function() {
                  art.getLabels().success(function(labels) {
                    expect(labels.length).toEqual(2)
                    
                    art.setLabels([]).success(function(labels) {
                      expect(labels.length).toEqual(0)
                      art.getLabels().success(function(labels) {
                        expect(labels.length).toEqual(0)
                        done()
                      })
                    })
                  })
                })
              })
            })
          })
        })
      })
      
      /*
      it('sets one label', function(done) {
        var self = this
        
        this.Article.create({
          title: 'An article'
        }).success(function(art) {
          self.Label.create({
            text: 'AWESOMENESS'
          }).success(function(label1) {
            self.Label.create({
              text: 'CUTENESS OVERLOAD'
            }).success(function(label2) {
              art.getLabels().success(function(labels) {
                expect(labels.length).toEqual(0)
                                    
                art.setLabels([label1]).success(function() {
                  art.getLabels().success(function(labels) {
                    expect(labels.length).toEqual(1)
                    expect(labels[0].text).toEqual(label1.text)
                    done()
                  })
                })
              })
            })
          })
        })
      })

  */
    /*  
      it('sets two labels', function(done) {
        var self = this
        
        this.Article.create({
          title: 'An article'
        }).success(function(art) {
          self.Label.create({
            text: 'AWESOMENESS'
          }).success(function(label1) {
            self.Label.create({
              text: 'CUTENESS OVERLOAD'
            }).success(function(label2) {
              art.getLabels().success(function(labels) {
                expect(labels.length).toEqual(0)
                                    
                art.setLabels([label1, label2]).success(function() {
                  art.getLabels().success(function(labels) {
                    expect(labels.length).toEqual(2)
                    expect(labels[0].text).toEqual(label1.text)
                                        
                    art.setLabels([]).success(function() {
                      art.getLabels().success(function(labels) {
                        expect(labels.length).toEqual(0)
                        done()
                      })
                    })
                  })
                })
              })
            })
          })
        })
      })

  */
    })
  })
})