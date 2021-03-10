var AWS = require('aws-sdk');
AWS.config.update({region: 'ap-southeast-1'});
var ddb = new AWS.DynamoDB({apiVersion: '2012-08-10'});
var docClient = new AWS.DynamoDB.DocumentClient();
var jwt = require('jsonwebtoken');
var uuid = require('uuid');

exports.handler = function (event, context, callback) {
  
    if (event.endpoint == "/signIn") {
        var params = {
          TableName: 'PocketStoreUsers',
          Key: {
            'UserId': {S: event.email}
          }
        };
        
        ddb.getItem(params, function(err, data) {
          if (err) {
            callback(null, 'err');
          } else {
            if (event.password == data.Item.Password.S) {
              callback(null, {"status":"ok", "email": event.email, "role": data.Item.Role.S, "token":jwt.sign({ "email": event.email, "role": data.Item.Role.S }, 'AVeryS3cretKey!')});
            } else {
              callback(null, {"status":"invalid"});
            }
          }
        });
    } else if (event.endpoint == "/newLoan") {
      jwt.verify(event.token, 'AVeryS3cretKey!', function(err, decoded) {
        if (err) {
          callback(null, {"status":"invalid"});
        } else if (decoded) {
          const email = decoded.email;
          const role = decoded.role;
          const dueDate = new Date(new Date().setDate(new Date().getDate() + 14));
          const loanItems = JSON.parse(event.data);
          const loanItemsFormatted = [];
          for (var index in loanItems) {
            loanItemsFormatted.push({
                M: {
                    "Id": {
                        "S": loanItems[index].id
                    },
                    "Name": {
                        "S": loanItems[index].name
                    },
                    "Qty": {
                        "N": loanItems[index].qty
                    }
                }
            });
          }
          var params = {
            TableName: 'PocketStoreLoans',
            Item: {
              'LoanId' : {S: uuid.v4().toString()},
              'LoanStatus' : {S: 'pending'},
              'DueDate': {S: dueDate.toLocaleDateString('default', {year: 'numeric', month: 'short', day: 'numeric'})},
              'LoanItems': {L: loanItemsFormatted},
              'UserId': {S: email}
            }
          };
          // Call DynamoDB to add the item to the table
          ddb.putItem(params, function(err, data) {
            if (err) {
              callback(Error(err), err);
              callback(null, {"status":"err"});
            } else {
              callback(null, {"status":"ok"});
            }
          });
        }
      });
    } else if (event.endpoint == "/myLoans") {
      jwt.verify(event.token, 'AVeryS3cretKey!', function(err, decoded) {
        if (err) {
          callback(null, {"status":"invalid"});
        } else if (decoded) {
          const email = decoded.email;
          const role = decoded.role;
          var params = {
              TableName: "PocketStoreLoans",
              FilterExpression: "#userid = :email",
              ExpressionAttributeNames: {
                  "#userid": "UserId",
              },
              ExpressionAttributeValues: {
                   ":email": email
              }
          };
          
          docClient.scan(params, (err, data) => {
              if (err) {
                  console.error("Unable to scan the table. Error JSON:", JSON.stringify(err, null, 2));
              } else {
                  callback(null, {"status":"ok", "loans":JSON.stringify(data)});
              }
          });
        }
      });
    } else if (event.endpoint == "/allLoans") {
      jwt.verify(event.token, 'AVeryS3cretKey!', function(err, decoded) {
        if (err) {
          callback(null, {"status":"invalid"});
        } else if (decoded) {
          const email = decoded.email;
          const role = decoded.role;
          if (role == "manager") {
            var params = {
                TableName: "PocketStoreLoans"
            };
            
            docClient.scan(params, (err, data) => {
                if (err) {
                    console.error("Unable to scan the table. Error JSON:", JSON.stringify(err, null, 2));
                } else {
                    callback(null, {"status":"ok", "allLoans":JSON.stringify(data)});
                }
            });
          }
        }
      });
    } else if (event.endpoint == "/updateStatus") {
      jwt.verify(event.token, 'AVeryS3cretKey!', function(err, decoded) {
        if (err) {
          callback(null, {"status":"invalid"});
        } else if (decoded) {
          const email = decoded.email;
          const role = decoded.role;
          if (role == "manager") {
            var params = {
                TableName:"PocketStoreLoans",
                Key:{
                    "LoanId": event.loanId
                },
                UpdateExpression: "set LoanStatus = :s",
                ExpressionAttributeValues:{
                    ":s":event.newStatus
                },
                ReturnValues:"UPDATED_NEW"
            };
            docClient.update(params, function(err, data) {
                if (err) {
                    console.error("Unable to update item. Error JSON:", JSON.stringify(err, null, 2));
                } else {
                    callback(null, {"status":"ok"});
                }
            });
          }
        }
      });
    } else if (event.endpoint == "/deleteLoan") {
      jwt.verify(event.token, 'AVeryS3cretKey!', function(err, decoded) {
        if (err) {
          callback(null, {"status":"invalid"});
        } else if (decoded) {
          const email = decoded.email;
          const role = decoded.role;
            var params = {
              TableName:"PocketStoreLoans",
              Key:{
                  "LoanId": event.loanId
              },
            ConditionExpression:"UserId = :e",
            ExpressionAttributeValues: {
                ":e": email
            }
          };
          
          docClient.delete(params, function(err, data) {
              if (err) {
                  console.error("Unable to delete item. Error JSON:", JSON.stringify(err, null, 2));
              } else {
                  callback(null, {"status":"ok"});
              }
          });
        }
      });
    }
};
