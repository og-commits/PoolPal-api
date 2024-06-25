const express = require('express');

const router = express.Router()

const Chat = require('../models/Chats')
const User = require('../models/Users');
const PMsg = require('../models/PoolMsg');
const GHBucket = require('../models/GHBuckets');

const Geohash = require('../utils/Geohashing');

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const dmaiKey = process.env.DMAI_API_KEY;

const getGhid = async (location) => {
    let url = "https://api.distancematrix.ai/maps/api/geocode/json?address=" + location + "&key=" + dmaiKey;
    let reponse = await fetch(url);
    let data = await reponse.json();

    return Geohash.encode(
        data.results[0].geometry.location.lat, 
        data.results[0].geometry.location.lng, 
        5
    );
}

router.post('/getpoolmsg', async (req, res) => {
    try {
        let from_ghid = await getGhid(req.body.fromloc);
        let to_ghid = await getGhid(req.body.toloc);

        let from_neighbours = Geohash.neighbours(from_ghid);
        let to_neighbours = Geohash.neighbours(to_ghid);

        if(!from_neighbours || !to_neighbours) 
            return res.status(400).json({ errors: 'No pools in this location.' });

        let allpmsg = [];

        for (let i = 0; i < from_neighbours.length; i++) {
            let fromBucket = await GHBucket.findOne({ Prefix: from_neighbours[i] });

            if (!fromBucket) continue;

            for (let j = 0; j < fromBucket.PoolMessageIDs.length; j++) {
                let pmsg = await PMsg.findById(fromBucket.PoolMessageIDs[j]);

                if (!pmsg) continue;

                if (to_neighbours.includes(pmsg.ToGhid)) {
                    allpmsg.push(pmsg);
                }
            }
        }

        res.send({ status: 'ok', data: allpmsg });
    }
    catch (error) {
        console.log(error);
    }
})

router.get('/getallpoolmsg', async (req, res) => {
    try {
        const allpmsg = await PMsg.find({});
        res.send({ status: 'ok', data: allpmsg });
    }
    catch (error) {
        console.log(error);
    }
})

router.post('/deletepmsg', async (req, res) => {
    try {
        let pmsg = await PMsg.findById(req.body.poolId);

        for (let i = 0; i < pmsg.chatids.length; i++) {

            let mychat = await Chat.findById(pmsg.chatids[i]);

            await User.updateOne(
                { _id: mychat.ownerid }, 
                { $pullAll: { chatids: [pmsg.chatids[i]]} }
            );

            await User.updateOne(
                { _id: mychat.requestorid }, 
                { $pullAll: { chatids: [pmsg.chatids[i]]} }
            );

            await Chat.findByIdAndDelete(pmsg.chatids[i]);
        }

        await PMsg.findByIdAndDelete(req.body.poolId);

        res.json({ success: true });
    }
    catch (error) {
        console.log(error);
        res.json({ success: false });
    }
})

router.post('/editpmsg', async (req, res) => {
    try {

        await PMsg.findByIdAndUpdate(req.body.poolId, {
            fromloc: req.body.fromloc,
            toloc: req.body.toloc,
            vtype: req.body.vtype,
            deptime: req.body.deptime,
            depdate: req.body.depdate,
            totalseats: req.body.totalseats,
            seatsleft: req.body.seatsleft
        })

        res.json({ success: true });
    }
    catch (error) {
        console.log(error);
        res.json({ success: false });
    }
})

router.post('/createpmsg', async (req, res) => {
    try {
        let ts = Number(req.body.totalseats);
        let sl = Number(req.body.seatsleft);

        if (ts <= sl || ts <= 1 || sl <= 0) {
            return res.status(400).json({ errors: 'Try logging with correct credentials' });
        }

        let from_ghid = await getGhid(req.body.fromloc);
        let to_ghid = await getGhid(req.body.toloc);

        let FromBucket = await GHBucket.findOne({ Prefix: from_ghid });
        let ToBucket = await GHBucket.findOne({ Prefix: to_ghid });

        if (!FromBucket) {
            FromBucket = await GHBucket.create({
                Prefix: from_ghid,
                PoolMessageIDs: []
            })
        }

        if (!ToBucket) {
            ToBucket = await GHBucket.create({
                Prefix: to_ghid,
                PoolMessageIDs: []
            })
        }

        let thisPmsg = await PMsg.create({
            fromloc: req.body.fromloc,
            toloc: req.body.toloc,
            vtype: req.body.vtype,
            deptime: req.body.deptime,
            depdate: req.body.depdate,
            totalseats: req.body.totalseats,
            seatsleft: req.body.seatsleft,
            username: req.body.username,
            ownerId: req.body.ownerId,
            FromGhid: FromBucket._id,
            ToGhid: ToBucket._id
        })

        if(!thisPmsg) return res.status(400).json({ errors: 'Try logging with correct credentials' });

        FromBucket.PoolMessageIDs.push(thisPmsg._id);
        ToBucket.PoolMessageIDs.push(thisPmsg._id);

        await FromBucket.save();
        await ToBucket.save();

        res.json({ success: true });
    }
    catch (error) {
        console.log(error);
        res.json({ success: false });
    }
})

module.exports = router; 