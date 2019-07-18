// Dependencies
const express = require("express"),
    bodyParser = require("body-parser"),
    logger = require("morgan"),
    mongoose = require("mongoose"),
    path = require("path"),
    // Require axios and cheerio. This makes the scraping possible
    axios = require("axios"),
    cheerio = require("cheerio"),
    //using handlebars
    exphbs = require("express-handlebars");


// Requiring Note and Article models
const Note = require("./models/Note");
const Article = require("./models/Article");

// Set mongoose to leverage build in Javascript ES6 Promises

mongoose.Promise = Promise;

// Define Port

const PORT = process.env.PORT || 3000;


// Initialize Express
const app = express();

//use morgan and body parser with our app
app.use(logger('dev'));
app.use(bodyParser.urlencoded({
    extended: false
}));

// Make public static dir

app.use(express.static('public'));

// Set Handlebars
app.engine("handlebars", exphbs({
    defaultLayout: "main",
    partialsDir: path.join(__dirname, "/views/layouts/partials")
}));

app.set("view engine", "handlebars");

// Connect to the Mongo DB
// Database configuration with mongoose
var db = mongoose.connection;
var MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost/webScrape";
mongoose.connect(MONGODB_URI);





// Show any mongoose errors
db.on("error", function (error) {
    console.log("Mongoose Error: ", error);
});

// Once logged into the db through mongoose, log a success message
db.once("open", function () {
    console.log("Mongoose connection successful.");
});

// Routes
// ==========

// GET requests to render Handlebars pages

app.get("/", function (req, res) {
    Article.find({ "saved": false }, function (error, data) {
        let hbsObject = {
            article: data
        };
        console.log(hbsObject);
        res.render("home", hbsObject);
    });
});

app.get("/saved", function (req, res) {
    Article.find({ 'saved': true }).populate("notes").exec(function (error, articles) {
        let hbsObject = {
            article: articles
        };
        res.render("saved", hbsObject);
    });
});

// A GET request to scrape the echojs website
app.get("/scrape", function (req, res) {
    
    //First we grab the body of the html with axios
    axios.get("https://techcrunch.com/").then(function (response) {
        // Load the html body from axios into cheerio
        var $ = cheerio.load(response.data);
        // console.log('this is cheerio '+ response.data);
        // For each element with a "article" class we grab a h2 within that element
        $(".post-block").each(function (i, element) {
            // Save an empty result object
            var result = {};
            
            //Add the title and summary of every link, and save them as properties
            //of the result object
            result.title = $(this).children(".post-block__header").children("h2").children("a").text().trim();
            // console.log(result.title.trim());
            //.post-block__content
            result.summary = $(this).children(".post-block__content").text().trim();
            result.link = $(this).children(".post-block__header").children("h2").children("a").attr("href");
            result.imgUrl= $(this).children(".post-block__footer").children(".post-block__media").children("a").children("img").attr("src");
            // console.log( result);
            //Using our Articlemodel, create a new entry
            //This effectively passes the result object to the entry 
            //(and the title and link)
            var entry = new Article(result);

            // Now, save that entry to the db
            entry.save(function (err, doc) {
                //Log any errors

                if (err) {
                  
                    console.log(err);
                }
                //or log the doc
                else {
                    console.log("This is doc: "+ doc);
                }
            });

        });
        res.send("Scrape Complete");
    });
    // Tell the browser that we finished scraping the text 
});

// This will get the articles we scraped from the mongoDB

app.get("/articles", function (req, res) {
    //Grab every doc in the Articles array
    Article.find({}, function (error, doc) {
        //log any errors
        if (error) {
            console.log(error);
        }
        else {
            res.json(doc);
        }
    });
});

//Grab an article by it's ObjectId
app.get("/articles/:id", function(req,res){
    //Using the id passed in the id parameter, prepare a query that finds 
    //the matching one in our db ..
    Article.findOne({"_id": req.params.id})
    //.. and populate all of the notes associated with it  "notes"
    .populate("note")
    // now, execute our query
    .exec(function(error,doc){
        //log any errors
        if(error){
            console.log(error);
        }
//otherwise, send the doc to the browser as a json object
        else {
            res.json(doc);
        }

    });
});

// Save an article
app.post("/articles/save/:id", function(req,res){
    //Use the article id to find an update its saved boolean
Article.findOneAndUpdate({"_id": req.params.id}, {"saved":true})
//execute the above query
.exec(function(err,doc){
    // log any errors
    if (err){
        console.log(err);
    }
    else{
        //send the document to the browser
        res.send(doc);
    }
});
});

//Delete an article
app.post("/articles/delete/:id", function(req,res){
    //Use the article id to find and update its saved boolean
    Article.findOneAndUpdate({"_id": req.params.id}, {"saved":false, "notes":[]})
    //Execute the above query
    .exec(function(err,doc){
        //Log any errors
        if (err){
            console.log(err);
        }
        else{
            //Or send the document to the browser
            res.send(doc);
        }
    });
});

// Create a new note
app.post("/notes/save/:id", function(req, res){
    // create a new note and pass the req.body to the entry
    let newNote = new Note({
        body:req.body.text,
        article: req.params.id
    });
    console.log(req.body);
    //And save the new note to the db
    newNote.save(function(error,note){
        //Log any errors
        if(error){
            console.log(error);
        }
        //Otherwise
        else{
            //Use the article id to find and update its notes
            Article.findOneAndUpdate({"_id": req.params.id}, {$push: {"notes":note} })
            // Execute teh above query
            .exec(function(err){
                //Log any errors
                if (err){
                    console.log(err);
                    res.send(err);
                }
                else {
                    //Or send the note to the browser
                    res.send(note);
                }
            });
        }
    });
}); 

// Delete a note
app.delete("/notes/delete/:note_id/:article_id", function(req,res){
    //Use the note id to find and delete it
    Note.findOneAndRemove({"_id": req.params.note_id}, function(err){
        //Log any errors
        if (err){
            console.log(err);
            res.send(err);
        }
        else{
            Article.findOneAndUpdate({"_id": req.params.article_id}, {$pull: {"notes": req.params.note}})
            .exec(function(err){
                if(err){
                    console.log(err);
                    res.send(err);
                }
                else{
                    //or send the note to the browser
                    res.send("Note Deleted");
                }
            });
        }
    });
});

//Listen on port

app.listen(PORT,function(){
    console.log("App running on port " + PORT);
});