DROP TABLE IF EXISTS Rooms;
CREATE TABLE IF NOT EXISTS Rooms (RoomId INTEGER PRIMARY KEY, CreatorIp TEXT, Explorer INTEGER, Shopper INTEGER, Vacationer INTEGER, Prisoner INTEGER);
INSERT INTO Rooms (RoomId, CreatorIp, Explorer, Shopper, Vacationer, Prisoner) VALUES (1, "1.2.3.4", 0, 0, 0, 0)