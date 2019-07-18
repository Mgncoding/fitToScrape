//Require Mongoose
const mongoose = require("mongoose");
const Note = require("./Note");
// Create Schema class
var Schema = mongoose.Schema;

// Create article schema
var ArticleSchema = new Schema({
    title: {
        type: String,
        required: true
    },
    summary: {
        type: String,
        required: true
    },
    link: {
        type: String,
        required: true
    },
    //this is for an Image
    imgUrl: {
        type: String,
        required: true
    },
    saved: {
        type: Boolean,
        default: false
    },
    notes: [{
        type: Schema.Types.ObjectId,
        ref: "Note"
    }]

});
// Create the Article model with the ArticleSchema
var Article = mongoose.model("Article", ArticleSchema);

//Export the model
module.exports = Article;