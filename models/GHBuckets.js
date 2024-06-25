const mongoose = require('mongoose')

const { Schema } = mongoose;

const GHBSchema = new Schema({
    Prefix:{
        type: String,
        required: true
    },
    PoolMessageIDs:{
        type: Array
    }
});

module.exports = mongoose.model('ghBuckets', GHBSchema)