miniActiveRecord = function(Collection){

  Collection = Collection || {};
  Collection.table = Collection.tableName;

  // inputString used by queries, overrides other strings
  // includes: create table, create relationship, drop table, insert
  Collection.inputString = '';
  Collection.inputString2 = '';
  Collection.autoSelectData = '';
  Collection.autoSelectInput = '';
  Collection.tableElements = {};

  // statement starters
  Collection.selectString = '';
  Collection.updateString = '';
  Collection.deleteString = '';

  // chaining statements
  Collection.joinString = '';
  Collection.whereString = '';
  Collection.clientWhereString = '';
  Collection.serverWhereString = '';

  // caboose statements
  Collection.orderString = '';
  Collection.limitString = '';
  Collection.offsetString = '';
  Collection.groupString = '';
  Collection.havingString = '';

  Collection.dataArray = [];
  Collection.dataArray2 = [];
  Collection.server = null;

  // error logging
  Collection.prevFunc = '';
  return Collection;
};

miniActiveRecord.prototype.createTable = function(tableObj) {
  var _DataTypes = {
    $number: 'integer',
    $string: 'varchar(255)',
    $json: 'json',
    $datetime: 'date',
    $float: 'decimal',
    $seq: 'serial',
    $bool: 'boolean'
  };

  var _TableConstraints = {
    $unique: 'unique',
    $check: 'check ', // value
    $exclude: 'exclude',
    $notnull: 'not null',
    $default: 'default ', // value
    $primary: 'primary key'
  };

  alasql.fn.Date = Date;

  var startString = 'CREATE TABLE ' + this.table + ' (';
  var item, subKey, valOperator, inputString = '';

  for (var key in tableObj) {
    this.tableElements[key] = key;
    inputString += key + ' ';
    inputString += _DataTypes[tableObj[key][0]];
    if (Array.isArray(tableObj[key]) && tableObj[key].length > 1) {
      for (var i = 1, count = tableObj[key].length; i < count; i++) {
        item = tableObj[key][i];
        if (typeof item === 'object') {
          subKey = Object.keys(item);
          valOperator = _TableConstraints[subKey];
          inputString += ' ' + valOperator + item[subKey];
        } else {
          inputString += ' ' + _TableConstraints[item];
        }
      }
    }
    inputString += ', ';
  }
  // check to see if id already provided
  if (inputString.indexOf('id') === -1) {
    startString += 'id serial primary key,';
  }

  this.inputString = startString + inputString + " createdat Date); ";
  this.prevFunc = 'CREATE TABLE';
   alasql(this.inputString);
   this.clearAll();
  return this;
};

miniActiveRecord.prototype.dropTable = function() {
  this.inputString = 'DROP TABLE IF EXISTS ' + this.table + ' CASCADE;';
  this.prevFunc = 'DROP TABLE';
  return this;
};

miniActiveRecord.prototype.insert = function(serverInserts, clientInserts) {
  console.log(this.tableElements);
  // server
  this.dataArray = [];
  var insertString = 'INSERT INTO ' + this.table + ' (';
  var valueString = ') VALUES (', j = 1;
  for (var key in serverInserts) {
    insertString += key + ', ';     // field
    this.dataArray.push(serverInserts[key]); // data
    valueString += '$' + j++ + ', ';   // $1, $2, etc
  }

  this.inputString = insertString.substring(0, insertString.length - 2) + valueString.substring(0, valueString.length - 2) + ');';

  if (clientInserts) {
    // client
    this.dataArray2 = [];
    var insertString2 = 'INSERT INTO ' + this.table + ' (';
    var valueString2 = ') VALUES (';
    for (var key2 in clientInserts) {
      insertString2 += key2 + ', ';
      this.dataArray2.push(clientInserts[key2]);
      valueString2 += '?, ';
    }
    for (var key3 in serverInserts) {
      insertString2 += key3 + ', ';
      this.dataArray2.push(serverInserts[key3]);
      valueString2 += '?, ';
    }
    this.server = true;
    this.inputString2 = insertString2.substring(0, insertString2.length - 2) + valueString2.substring(0, valueString2.length - 2) + ');';
  }
  this.prevFunc = 'INSERT';
  return this;
};

miniActiveRecord.prototype.update = function(updates) {
  this.updateString = 'UPDATE ' + this.table + ' SET ';
  for (var key in updates) {
    if (typeof updates[key] === 'number' && !isNaN(updates[key]) || typeof(updates[key]) === "boolean"){
      this.updateString += key + ' = ' + updates[key] + ', ';
    }
    else {
      this.updateString += key + ' = "' + updates[key] + '", ';
    }
  }
  this.updateString = this.updateString.substring(0,this.updateString.length-2);
  this.prevFunc = 'UPDATE';
  return this;
};

miniActiveRecord.prototype.remove = function() {
  this.deleteString = 'DELETE FROM ' + this.table;
  this.prevFunc = 'DELETE';
  return this;
};

miniActiveRecord.prototype.select = function(/*arguments*/) {
  var args = '';
  if (arguments.length >= 1) {
    for (var i = 0; i < arguments.length; i++) {
      if (arguments[i] === 'distinct') {
        args += 'DISTINCT ';
      } else {
        args += arguments[i] + ', ';
      }
    }
    args = args.substring(0, args.length - 2);
  } else {
    args += '*';
  }
  this.selectString = 'SELECT ' + args + ' FROM ' + this.table + " ";
  this.prevFunc = 'SELECT';
  return this;
};

miniActiveRecord.prototype.findOne = function(/*arguments*/) {
  if (arguments.length === 2) {
    this.inputString = 'SELECT * FROM ' + this.table + ' WHERE ' + this.table + '.id = ' + args + ' LIMIT 1;';
  } else {
    this.inputString = 'SELECT * FROM ' + this.table + ' LIMIT 1';
  }
  this.prevFunc = 'FIND ONE';
  return this;
};

miniActiveRecord.prototype.join = function(joinType, fields, joinTable) {
  if (Array.isArray(joinType)) {
    for (var x = 0, count = fields.length; x < count; x++) {
      this.joinString = " " + joinType[x] + " " + joinTable[x][0] + " ON " + this.table + "." + fields[x] + " = " + joinTable[x][0] + "." + joinTable[x][1];
    }
  } else {
    this.joinString = " " + joinType + " " + joinTable + " ON " + this.table + "." + fields + " = " + joinTable + "." + joinTable;
  }
  this.prevFunc = "JOIN";
  return this;
};

miniActiveRecord.prototype.where = function(/*Arguments*/) {
  this.dataArray = [];
  this.dataArray2 = [];

  var where = '', redux, substring1, substring2;
  where += arguments[0];
  // replace ? with rest of array
  for (var i = 1, count = arguments.length; i < count; i++) {
    redux = where.indexOf('?');
    substring1 = where.substring(0, redux);
    substring2 = where.substring(redux + 1, where.length);
    where = substring1 + '$' + i + substring2;
    this.dataArray.push(arguments[i]);
  }
  this.serverWhereString = ' WHERE ' + where;

  var where = '', redux, substring1, substring2;
  where += arguments[0];
  // replace ? with rest of array
  for (var i = 1, count = arguments.length; i < count; i++) {
    redux = where.indexOf('?');
    this.dataArray2.push(arguments[i]);
  }
  this.clientWhereString = ' WHERE ' + where;


  return this;

  //this.dataArray = [];
  //var where = '';
  //if (client === 'client') {
  //  if (Array.isArray(arguments[1])) {
  //    var array = arguments[1];
  //    where += array[1];
  //    for (var i = 1, count = array.length; i < count; i++) {
  //      this.dataArray.push(array[i]);
  //    }
  //  } else {
  //    where += arguments[0];
  //    for (var i = 1, count = arguments.length; i < count; i++) {
  //      this.dataArray.push(arguments[i]);
  //    }
  //  }
  //  this.whereString = ' WHERE ' + where;
  //} else {
  //  var redux, substring1, substring2;
  //  var argsArray = arguments;
  //  where += argsArray[0];
  //  for (var i = 1, count = argsArray.length; i < count; i++) {
  //    redux = where.indexOf('?');
  //    substring1 = where.substring(0, redux);
  //    substring2 = where.substring(redux + 1, where.length);
  //    where = substring1 + '$' + i + substring2;
  //    this.dataArray.push(argsArray[i]);
  //  }
  //  this.whereString = ' WHERE ' + where;
  //}

  //console.log(this.whereString);
  //return this;
};

miniActiveRecord.prototype.order = function(/*arguments*/) {

  var args = '';
  if (arguments.length > 1) {
    for (var i = 0; i < arguments.length; i++) {
      args += arguments[i] + ', ';
    }
    args = args.substring(0, args.length - 2);
  } else {
    args = arguments[0];
  }
  this.orderString = ' ORDER BY ' + args;
  return this;
};

miniActiveRecord.prototype.limit = function(limit) {
  this.limitString = ' LIMIT ' + limit;
  return this;
};

miniActiveRecord.prototype.offset = function(offset) {
  this.offsetString = ' OFFSET ' + offset;
  return this;
};

miniActiveRecord.prototype.group = function(group) {
  this.groupString = 'GROUP BY ' + group;
  return this;
};

miniActiveRecord.prototype.first = function(limit) {
  limit = limit || 1;
  this.inputString += 'SELECT * FROM ' + this.table + ' ORDER BY ' + this.table + '.id ASC LIMIT ' + limit + ';';
  this.prevFunc = 'FIRST';
  return this;
};

miniActiveRecord.prototype.last = function(limit) {
  limit = limit || 1;
  this.inputString += 'SELECT * FROM ' + this.table + ' ORDER BY ' + this.table + '.id DESC LIMIT ' + limit + ';';
  this.prevFunc = 'LAST';
  return this;
};

miniActiveRecord.prototype.take = function(limit) {
  limit = limit || 1;
  this.inputString += 'SELECT * FROM ' + this.table + ' LIMIT ' + limit + ';';
  this.prevFunc = 'TAKE';
  return this;
};

miniActiveRecord.prototype.clearAll = function() {
  this.inputString = '';
  this.inputString2 = '';
  this.autoSelectData = '';
  this.autoSelectInput = '';

  // statement starters
  this.selectString = '';
  this.updateString = '';
  this.deleteString = '';

  // chaining statements
  this.joinString = '';
  this.whereString = '';
  this.clientWhereString = '';
  this.serverWhereString = '';

  // caboose statements
  this.orderString = '';
  this.limitString = '';
  this.offsetString = '';
  this.groupString = '';
  this.havingString = '';

  this.dataArray = [];
  this.dataArray2 = [];
  this.server = null;

  // error logging
  this.prevFunc = '';
};

miniActiveRecord.prototype.fetch = function(client) {

  this.reactiveData.depend();

  var dataArray = this.dataArray;
  var starter = this.updateString || this.deleteString || this.selectString;

  var input = this.inputString.length > 0 ? this.inputString : starter + this.joinString + this.clientWhereString + this.orderString + this.limitString +
  this.offsetString + this.groupString + this.havingString + ';';


  // alaSQL
  var result = alasql(input, dataArray);

  // postgres
  console.log(505, result);
  var name = this.table + 'fetch';
  if (client !== "client") {
    input = this.inputString.length > 0 ? this.inputString : starter + this.joinString + this.serverWhereString + this.orderString + this.limitString +
    this.offsetString + this.groupString + this.havingString + ';';
    Meteor.call(name, input, dataArray);
  }
  this.clearAll();
  return result;
};

miniActiveRecord.prototype.save = function(client) {

  //var table = this.table;
  //var prevFunc = this.prevFunc;

  var dataArray = this.dataArray;
  var dataArray2 = this.dataArray2;
  var starter = this.updateString || this.deleteString || this.selectString;
  var input = this.inputString2.length > 0 ? this.inputString2 : starter + this.joinString + this.clientWhereString + ';';
  // alaSQL
  //if (input = ";"){
  //  throw 'error';
  //}
  var result = alasql(input, dataArray2);
  // postgres
  var self = this;
  var name = this.table + 'save';
  if (client !== "client") {
    input = this.inputString.length > 0 ? this.inputString : starter + this.joinString + this.serverWhereString + ';';
    Meteor.call(name, input, dataArray);
  }
  this.reactiveData.changed();

  this.clearAll();
  return result;
};