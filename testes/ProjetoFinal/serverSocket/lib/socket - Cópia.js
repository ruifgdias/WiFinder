/* global process, module, assert, result */

var net = require('net');
var r = require('rethinkdb');

var ServerSocket = function (port, configdb, sensorcfg) {
  this.port = port;
  this.net = require('net');
  this.serverSck = net.createServer(this.net);
  this.clienteSend = sensorcfg.name;
  this.lati = sensorcfg.lati;
  this.long = sensorcfg.long;
  this.local = sensorcfg.loc;
  this.dbConfig = configdb;

  this.dbData = {
    host: this.dbConfig.host,
    port: this.dbConfig.port
  };

};

ServerSocket.prototype.start = function () {
  this.serverSck.listen(this.port);

  var self = this;
  this.serverSck.on('connection', function (sock) {

    // We have a connection - a socket object is assigned to the connection automatically
    console.log('CONNECTED: IP - ' + sock.remoteAddress + ' Port - ' + sock.remotePort);

    // Add a 'data' event handler to this instance of socket
    sock.on('data', function (data) {
      var client = self.clienteSend;
      var latitude = self.lati;
      var longitude = self.long;
      var local = self.local;
      var aux = data.toString();
      var resultLine = aux.split("\r\n");
      for (var i in resultLine) {
        var line = resultLine[i];
        if (line[2] == ":" && line.length > 4) { // verfica se a linha recebida tem na terceira posicao :
          var result = line.split(", ");
          if (result[0].trim().length == 17) { // verificacao do tamanho do macaddress recebido
            if (result.length < 8) {
              var valsHost = result;
              var valuesHst = result;
              r.connect(self.dbData).then(function (conn) {
                return r.db(self.dbConfig.db).table("DispMoveis").get(valsHost[0]).replace(function (row) {
                  return r.branch(
                          row.eq(null),
                          {
                            "macAddress": valsHost[0],
                            "nameVendor": r.db(self.dbConfig.db).table("tblPrefix").get(valsHost[0].substring(0, 8)).getField("vendor").default(""),
                            "disp": [{
                                name: client,
                                "values": [{
                                    "First_time": r.now().inTimezone("+01:00"), //(typeof valsHost[1] == "undefined") ? "" : valsHost[1],
                                    "Last_time": r.now().inTimezone("+01:00"), //(typeof valsHost[2] == "undefined") ? "" : valsHost[2],
                                    "Power": (typeof valsHost[3] == "undefined") ? "" : valsHost[3],
                                    "packets": (typeof valsHost[4] == "undefined") ? "" : valsHost[4],
                                    "BSSID": (typeof valsHost[5] == "undefined") ? "" : valsHost[5].replace(/,| /g, ""),
                                    "Probed_ESSIDs": (typeof valsHost[6] == "undefined") ? "" : valsHost[6].split(",")
                                  }]
                              }]
                          },
                  r.branch(
                          row("disp")("name").contains(client),
                          row.merge({
                            "disp": row('disp').map(function (d) {
                              return r.branch(
                                      d('name').eq(client).default(false),
                                      d.merge({values: d('values').append({
                                          "First_time": r.db(self.dbConfig.db).table("DispMoveis").get(valsHost[0]).do(function (row) {
                                            return  row("disp")("values").nth(0).getField("First_time")
                                          }).limit(1).nth(0),
                                          "Last_time": r.now().inTimezone("+01:00"),
                                          "Power": (typeof valsHost[3] == "undefined") ? "" : valsHost[3],
                                          "packets": (typeof valsHost[4] == "undefined") ? "" : valsHost[4],
                                          "BSSID": (typeof valsHost[5] == "undefined") ? "" : valsHost[5].replace(/,| /g, ""),
                                          "Probed_ESSIDs": (typeof valsHost[6] == "undefined") ? "" : r.db(self.dbConfig.db)
                                                  .table("DispMoveis")
                                                  .get(valsHost[0])
                                                  .do(function (row) {
                                                    return r.branch(
                                                            row.eq(null),
                                                            "",
                                                            row("disp")
                                                      .filter({"name": client})
                                                              .do(function (row1) {
                                                              return r.branch(
                                                              row1.eq([]),
                                                              "",
                                                              row1.nth(0)("values")
                                                              .orderBy(r.desc("Last_time"))
                                                              .limit(1)("Probed_ESSIDs")
                                                    .nth(0)
                            .setUnion(valsHost[6].split(","))
                            );
                            }));
                                                  })})}),
                                      d);
                            })}),
                              {                             "macAddress": valsHost[0],
                                  "nameVendor": r.db(self.dbConfig.db).table("tblPrefix").get(valsHost[0].substring(0, 8)).getField("vendor").default(""),
                                  "disp": row("disp").append({
                              "name": client,
                              "values": [{
                                  "First_time": r.now().inTimezone("+01:00"), //(typeof valsHost[1] == "undefined") ? "" : valsHost[1],
                                  "Last_time": r.now().inTimezone("+01:00"), //(typeof valsHost[2] == "undefined") ? "" : valsHost[2],
                                  "Power": (typeof valsHost[3] == "undefined") ? "" : valsHost[3],
                                          "packets": (typeof valsHost[4] == "undefined") ? "" : valsHost[4],
                                          "BSSID": (typeof valsHost[5] == "undefined") ? "" : valsHost[5].replace(/,| /g, ""),
                                            "Probed_ESSIDs": (typeof valsHost[6] == "undefined") ? "" : r.db(self.dbConfig.db)
                                                    .table("DispMoveis")
                                                    .get(valsHost[0])
                                                    .do(function (row) {
                                              return r.branch(
                                                      row.eq(null),
                                                    "",
                                                      row("disp")
                                                      .filter({"name": client})
                                                    .do(function (row1) {
                                                      return r.branch(
                                                      row1.eq([]),
                                                              "",
                                          row1.nth(0)("values")
                        .orderBy(r.desc("Last_time"))
              .limit(1)("Probed_ESSIDs")
              .nth(0)
                .setUnion(valsHost[6].split(",")));
                  }));
                          })}]})}));
                            }, {nonAtomic: true}).run(conn)
                            .finally(function () {
                                conn.close();
                        });
                                });

              r.connect(self.dbData).then(function (conn) {
                                return r.db(self.dbConfig.db).table("AntDisp").get(client).replace(function (row) {
                                return r.branch(
                          row.eq(null),
                          {
                                "nomeAntena": client,
                                "host": [{                                 "macAddress": valuesHst[0],
                                "data": r.now().inTimezone("+01:00"),
                              "Power": (typeof valuesHst[3] == "undefined") ? "" : valuesHst[3],
                          "BSSID": (typeof valuesHst[5] == "undefined") ? "" : valuesHst[5].replace(/,| /g, ""),
                                      "Probed_ESSIDs": (typeof valuesHst[6] == "undefined") ? "" : valuesHst[6].split(","),                                 "nameVendor": r.db(self.dbConfig.db).table("tblPrefix").get(valuesHst[0].substring(0, 8)).getField("vendor").default("")
                                        }]
                          },
                  r.branch(
                                        row("host")("macAddress").contains(valuesHst[0]),
                                        row.merge({
                            "host": row("host").map(function (d) {
                                        return r.branch(
                                      d("macAddress").eq(valuesHst[0]).default(false),
                                        {
                                        "macAddress": valuesHst[0],
                                                "data": r.now().inTimezone("+01:00"),
                                                "Power": (typeof valuesHst[3] == "undefined") ? "" : valuesHst[3],
                                                          "BSSID": (typeof valuesHst[5] == "undefined") ? "" : valuesHst[5].replace(/,| /g, ""),
                                                          "Probed_ESSIDs": (typeof valuesHst[6] == "undefined") ? "" : r.db(self.dbConfig.db)
                                                .table("DispMoveis")
                                                    .get(valsHost[0])
                                                            .do(function (row) {
                                                            return r.branch(
                                                            row.eq(null),
                                                            "",
                                                            row("disp")
                                                            .filter({"name": client})
                                                            .do(function (row1) {
                                                            return r.branch(
                                                            row1.eq([]),
                                                  "",
                                                row1
                                        .nth(0)("values")
                                      .orderBy(r.desc("Last_time"))
                            .limit(1)("Probed_ESSIDs")
                          .nth(0).
                              setUnion(valsHost[6].split(","))
                              );
                              }));
                                                }),
                              "nameVendor": r.db(self.dbConfig.db).table("tblPrefix").get(valuesHst[0].substring(0, 8)).getField("vendor").default("")
                                      },
                                      d);
                            })}),
                                      {
                                      "nomeAntena": client,
                            "host": row("host").append({
                                                "macAddress": valuesHst[0],
                                                "data": r.now().inTimezone("+01:00"),
                                                "Power": (typeof valuesHst[3] == "undefined") ? "" : valuesHst[3],
                                                  "BSSID": (typeof valuesHst[5] == "undefined") ? "" : valuesHst[5].replace(/,| /g, ""),
                                                  "Probed_ESSIDs": (typeof valuesHst[6] == "undefined") ? "" : r.db(self.dbConfig.db)
                                                  .table("DispMoveis")
                                      .get(valsHost[0])
                                                  .do(function (row) {
                                                  return r.branch(
                                                  row.eq(null),
                                                  "",
                                                row("disp")
                                        .filter({"name": client})
                                      .do(function (row1) {
                              return r.branch(
                                                          row1.eq([]),
                          "",
                row1
                          .nth(0)("values")
            .orderBy(r.desc("Last_time"))
              .limit(1)("Probed_ESSIDs")
              .nth(0)
                .setUnion(valsHost[6].split(","))
                  );
                          }));
                            }),
                            "nameVendor": r.db(self.dbConfig.db).table("tblPrefix").get(valuesHst[0].substring(0, 8)).getField("vendor").default("")
                            })}));
                                }, {nonAtomic: true}).run(conn)
                                .finally(function () {
                                    conn.close();
                        });
              });
                                    } else { // if de verificacao do tamanho do array < 8
              var valsAp = result;
                                    var valuesAp = result;
              r.connect(self.dbData).then(function (conn) {
                                    return r.db(self.dbConfig.db).table("DispAp").get(valsAp[0]).replace(function (row) {
                                    return r.branch(
                          row.eq(null),
                                    {
                            "macAddress": valsAp[0],
                            "nameVendor": r.db(self.dbConfig.db).table("tblPrefix").get(valsAp[0].substring(0, 8)).getField("vendor").default(""),
                                    "disp": [{
                                name: client,
                                "values": [{
                                    "First_time": r.now().inTimezone("+01:00"),
                                    "Last_time": r.now().inTimezone("+01:00"),
                                    "channel": (typeof valsAp[3] == "undefined") ? "" : valsAp[3],
                                    "Speed": (typeof valsAp[4] == "undefined") ? "" : valsAp[4],
                                    "Privacy": (typeof valsAp[5] == "undefined") ? "" : valsAp[5],
                                    "Cipher": (valsAp.length == 14) ? ((typeof valsAp[6] == "undefined") ? "" : (typeof valsAp[6].split(",")[0] == "undefined") ? "" : valsAp[6].split(",")[0]) : valsAp[6],
                                    "Authentication": (valsAp.length == 14) ? ((typeof valsAp[6] == "undefined") ? "" : (typeof valsAp[6].split(",")[1] == "undefined") ? "" : valsAp[6].split(",")[1]) : valsAp[7],
                              "Power": (valsAp.length == 14) ? ((typeof valsAp[7] == "undefined") ? "" : valsAp[7]) : ((typeof valsAp[8] == "undefined") ? "" : valsAp[8]),                                     "beacons": (valsAp.length == 14) ? ((typeof valsAp[8] == "undefined") ? "" : valsAp[8]) : ((typeof valsAp[9] == "undefined") ? "" : valsAp[9]),                                     "IV": (valsAp.length == 14) ? ((typeof valsAp[9] == "undefined") ? "" : valsAp[9]) : ((typeof valsAp[10] == "undefined") ? "" : valsAp[10]),
                            "LAN_IP": (valsAp.length == 14) ? ((typeof valsAp[10] == "undefined") ? "" : valsAp[10]) : ((typeof valsAp[11] == "undefined") ? "" : valsAp[11]),
                                  "ID_length": (valsAp.length == 14) ? ((typeof valsAp[11] == "undefined") ? "" : valsAp[11]) : ((typeof valsAp[12] == "undefined") ? "" : valsAp[12]),
                                    "ESSID": (valsAp.length == 14) ? ((typeof valsAp[12] == "undefined") ? "" : valsAp[12]) : ((typeof valsAp[13] == "undefined") ? "" : valsAp[13]),
                                  "key": (valsAp.length == 14) ? ((typeof valsAp[13] == "undefined") ? "" : valsAp[13]) : ((typeof valsAp[14] == "undefined") ? "" : valsAp[14])
                                  }]
                              }]
                                  },
                  r.branch(
                                  row("disp")("name").contains(client),
                          row.merge({
                                  "disp": row('disp').map(function (d) {
                              return r.branch(d('name').eq(client).default(false), d.merge({values: d("values").append({
                                  "First_time": r.db(self.dbConfig.db).table("DispAp").get(valsAp[0]).do(function (row) {                                     return  row("disp")("values").nth(0).getField("First_time")
                                  }).limit(1).nth(0),
                                  "Last_time": r.now().inTimezone("+01:00"),
                                  "channel": (typeof valsAp[3] == "undefined") ? "" : valsAp[3],
                                  "Speed": (typeof valsAp[4] == "undefined") ? "" : valsAp[4],
                                  "Privacy": (typeof valsAp[5] == "undefined") ? "" : valsAp[5],
                                  "Cipher": (valsAp.length == 14) ? ((typeof valsAp[6] == "undefined") ? "" : (typeof valsAp[6].split(",")[0] == "undefined") ? "" : valsAp[6].split(",")[0]) : valsAp[6],
                                  "Authentication": (valsAp.length == 14) ? ((typeof valsAp[6] == "undefined") ? "" : (typeof valsAp[6].split(",")[1] == "undefined") ? "" : valsAp[6].split(",")[1]) : valsAp[7],
                                  "Power": (valsAp.length == 14) ? ((typeof valsAp[7] == "undefined") ? "" : valsAp[7]) : ((typeof valsAp[8] == "undefined") ? "" : valsAp[8]),
                                  "beacons": (valsAp.length == 14) ? ((typeof valsAp[8] == "undefined") ? "" : valsAp[8]) : ((typeof valsAp[9] == "undefined") ? "" : valsAp[9]),
                            "IV": (valsAp.length == 14) ? ((typeof valsAp[9] == "undefined") ? "" : valsAp[9]) : ((typeof valsAp[10] == "undefined") ? "" : valsAp[10]),
                            "LAN_IP": (valsAp.length == 14) ? ((typeof valsAp[10] == "undefined") ? "" : valsAp[10]) : ((typeof valsAp[11] == "undefined") ? "" : valsAp[11]),
                              "ID_length": (valsAp.length == 14) ? ((typeof valsAp[11] == "undefined") ? "" : valsAp[11]) : ((typeof valsAp[12] == "undefined") ? "" : valsAp[12]),
                                  "ESSID": (valsAp.length == 14) ? ((typeof valsAp[12] == "undefined") ? "" : valsAp[12]) : ((typeof valsAp[13] == "undefined") ? "" : valsAp[13]),
                                  "key": (valsAp.length == 14) ? ((typeof valsAp[13] == "undefined") ? "" : valsAp[13]) : ((typeof valsAp[14] == "undefined") ? "" : valsAp[14])
                                  })}), d);
                            })}),
                                  {                             "macAddress": valsAp[0],
                                  "nameVendor": r.db(self.dbConfig.db).table("tblPrefix").get(valsAp[0].substring(0, 8)).getField("vendor").default(""),                             "disp": row('disp').append({
                              name: client,
                                  "values": [{
                                  "First_time": r.now().inTimezone("+01:00"), //(typeof valsAp[1] == "undefined") ? "" : valsAp[1],
                                  "Last_time": r.now().inTimezone("+01:00"), //(typeof valsAp[2] == "undefined") ? "" : valsAp[2],
                                  "channel": (typeof valsAp[3] == "undefined") ? "" : valsAp[3],
                                  "Speed": (typeof valsAp[4] == "undefined") ? "" : valsAp[4],
                                  "Privacy": (typeof valsAp[5] == "undefined") ? "" : valsAp[5],
                                  "Cipher": (valsAp.length == 14) ? ((typeof valsAp[6] == "undefined") ? "" : (typeof valsAp[6].split(",")[0] == "undefined") ? "" : valsAp[6].split(",")[0]) : valsAp[6],
                                  "Authentication": (valsAp.length == 14) ? ((typeof valsAp[6] == "undefined") ? "" : (typeof valsAp[6].split(",")[1] == "undefined") ? "" : valsAp[6].split(",")[1]) : valsAp[7],
                                  "Power": (valsAp.length == 14) ? ((typeof valsAp[7] == "undefined") ? "" : valsAp[7]) : ((typeof valsAp[8] == "undefined") ? "" : valsAp[8]),
                                  "beacons": (valsAp.length == 14) ? ((typeof valsAp[8] == "undefined") ? "" : valsAp[8]) : ((typeof valsAp[9] == "undefined") ? "" : valsAp[9]),
                            "IV": (valsAp.length == 14) ? ((typeof valsAp[9] == "undefined") ? "" : valsAp[9]) : ((typeof valsAp[10] == "undefined") ? "" : valsAp[10]),
                        "LAN_IP": (valsAp.length == 14) ? ((typeof valsAp[10] == "undefined") ? "" : valsAp[10]) : ((typeof valsAp[11] == "undefined") ? "" : valsAp[11]),
                "ID_length": (valsAp.length == 14) ? ((typeof valsAp[11] == "undefined") ? "" : valsAp[11]) : ((typeof valsAp[12] == "undefined") ? "" : valsAp[12]),
                            "ESSID": (valsAp.length == 14) ? ((typeof valsAp[12] == "undefined") ? "" : valsAp[12]) : ((typeof valsAp[13] == "undefined") ? "" : valsAp[13]),
                                "key": (valsAp.length == 14) ? ((typeof valsAp[13] == "undefined") ? "" : valsAp[13]) : ((typeof valsAp[14] == "undefined") ? "" : valsAp[14])
                                }]
                            })                           }));
                                }, {nonAtomic: true}).run(conn)
                        .finally(function () {
                          conn.close();
                        });
              });
                                r.connect(self.dbData).then(function (conn) {
                return r.db(self.dbConfig.db).table("AntAp").get(client).replace(function (row) {
                  return r.branch(
                          row.eq(null),
                                {
                            "nomeAntena": client,
                            "host": [{
                                "macAddress": valuesAp[0],
                                "channel": (typeof valuesAp[3] == "undefined") ? "" : valuesAp[3],
                                "Privacy": (typeof valuesAp[5] == "undefined") ? "" : valuesAp[5],
                                "Cipher": (valuesAp.length == 14) ? ((typeof valuesAp[6] == "undefined") ? "" : (typeof valuesAp[6].split(",")[0] == "undefined") ? "" : valuesAp[6].split(",")[0]) : valuesAp[6],
                          "Authentication": (valuesAp.length == 14) ? ((typeof valuesAp[6] == "undefined") ? "" : (typeof valuesAp[6].split(",")[1] == "undefined") ? "" : valuesAp[6].split(",")[1]) : valuesAp[7],
                                      "ESSID": (valuesAp.length == 14) ? ((typeof valuesAp[12] == "undefined") ? "" : valuesAp[12]) : ((typeof valuesAp[13] == "undefined") ? "" : valuesAp[13]),
                                        "data": r.now().inTimezone("+01:00"),
                                        "Power": (valuesAp.length == 14) ? ((typeof valuesAp[7] == "undefined") ? "" : valuesAp[7]) : ((typeof valuesAp[8] == "undefined") ? "" : valuesAp[8]),
                                        "nameVendor": r.db(self.dbConfig.db).table("tblPrefix").get(valuesAp[0].substring(0, 8)).getField("vendor").default("")
                              }]
                          },
                  r.branch(
                                        row("host")("macAddress").contains(valuesAp[0]),
                          row.merge({
                            "host": row("host").map(function (d) {
                              return r.branch(
                                        d("macAddress").eq(valuesAp[0]).default(false),
                                      {
                                        "macAddress": valuesAp[0],
                                        "channel": (typeof valuesAp[3] == "undefined") ? "" : valuesAp[3],
                                        "Privacy": (typeof valuesAp[5] == "undefined") ? "" : valuesAp[5],                                         "Cipher": (valuesAp.length == 14) ? ((typeof valuesAp[6] == "undefined") ? "" : (typeof valuesAp[6].split(",")[0] == "undefined") ? "" : valuesAp[6].split(",")[0]) : valuesAp[6],
                            "Authentication": (valuesAp.length == 14) ? ((typeof valuesAp[6] == "undefined") ? "" : (typeof valuesAp[6].split(",")[1] == "undefined") ? "" : valuesAp[6].split(",")[1]) : valuesAp[7],
                              "ESSID": (valuesAp.length == 14) ? ((typeof valuesAp[12] == "undefined") ? "" : valuesAp[12]) : ((typeof valuesAp[13] == "undefined") ? "" : valuesAp[13]),
                              "data": r.now().inTimezone("+01:00"),
                              "Power": (valuesAp.length == 14) ? ((typeof valuesAp[7] == "undefined") ? "" : valuesAp[7]) : ((typeof valuesAp[8] == "undefined") ? "" : valuesAp[8]),
                              "nameVendor": r.db(self.dbConfig.db).table("tblPrefix").get(valuesAp[0].substring(0, 8)).getField("vendor").default("")
                                      }, d)
                            })
                          }),
                              {
                            "nomeAntena": client,
                            "host": row("host").append({
                              "macAddress": valuesAp[0],                               "channel": (typeof valuesAp[3] == "undefined") ? "" : valuesAp[3],
                              "Privacy": (typeof valuesAp[5] == "undefined") ? "" : valuesAp[5],
                              "Cipher": (valuesAp.length == 14) ? ((typeof valuesAp[6] == "undefined") ? "" : (typeof valuesAp[6].split(",")[0] == "undefined") ? "" : valuesAp[6].split(",")[0]) : valuesAp[6],
                        "Authentication": (valuesAp.length == 14) ? ((typeof valuesAp[6] == "undefined") ? "" : (typeof valuesAp[6].split(",")[1] == "undefined") ? "" : valuesAp[6].split(",")[1]) : valuesAp[7],
      "ESSID": (valuesAp.length == 14) ? ((typeof valuesAp[12] == "undefined") ? "" : valuesAp[12]) : ((typeof valuesAp[13] == "undefined") ? "" : valuesAp[13]),
        "data": r.now().inTimezone("+01:00"),
                    "Power": (valuesAp.length == 14) ? ((typeof valuesAp[7] == "undefined") ? "" : valuesAp[7]) : ((typeof valuesAp[8] == "undefined") ? "" : valuesAp[8]),
                    "nameVendor": r.db(self.dbConfig.db).table("tblPrefix").get(valuesAp[0].substring(0, 8)).getField("vendor").default("")
                            })
                  }));
            }, {nonAtomic: true}).run(conn)
            .finally(function () {
            conn.close();
            });
              });
                } // else da verificacao do tamanho do arraymais de 8
                } // fim verificacao do tamanho do macaddress
        }
      }
      r.connect(self.dbData).then(function (conn) {
    return r.db(self.dbConfig.db).table("ActiveAnt").get(client).replace(function (row) {
    return r.branch(
      row.eq(null),
                  {
                    "nomeAntena": client,
  "latitude": latitude,
"longitude": longitude,
                    "local": local,
  "data": r.now().inTimezone("+01:00")
                  },
  {
"nomeAntena": client,
            "latitude": latitude,
            "longitude": longitude,
            "local": local,
"data": r.now().inTimezone("+01:00")
          });
        }).run(conn)
                .finally(function () {
                  conn.close();
                });
      });
      console.log('--------------------------------------------------------');
    });
    // Add a 'close' event handler to this instance of socket
    sock.on('disconnect', function (data) {
      console.log('CLOSED: ' + sock.remoteAddress + ' ' + sock.remotePort);
    });
  });
  console.log('Server Socket Wait : ' + this.port);
};


process.on("message", function (data) {
  var serverskt = new ServerSocket(data.port, data.configdb, data.sensorcfg);
  serverskt.start();
});
//excepcoes para os erros encontrados
//process.on('uncaughtException', function (err) {
//    console.log('Excepcao capturada: ' + err);
//});
module.exports = ServerSocket;