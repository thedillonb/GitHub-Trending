var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var dbURI = process.env['DB_URL'];

if (!dbURI) throw new Error('DB_URL has not been set in the environmental variables!');

var toJSONOptions = {
    transform: function(doc, ret) {
        delete ret._id;
        return ret;
    }
};

var trendingSchema = new Schema({
    language: {
        name: String,
        slug: String
    },
    repositories: {
        daily: [Schema.Types.Mixed],
        weekly: [Schema.Types.Mixed],
        monthly: [Schema.Types.Mixed]
    }
}, { 
    versionKey: false,
    collection: 'trendings.v2'
});

trendingSchema.options.toJSON = toJSONOptions;
trendingSchema.index({ 'language.slug': 1 });

var exploreSchema = new Schema({
    name: String,
    slug: String,
    image: String,
    description: String,
    repositories: [Schema.Types.Mixed]
}, { 
    versionKey: false,
    collection: 'explores.v2'
});

exploreSchema.options.toJSON = toJSONOptions;
exploreSchema.index({ slug: 1 });

mongoose.connection.on('error', function (err) {
    console.error(err);
});

mongoose.connection.on('disconnected', function () {
    console.log('Connection to MongoDB has been disconnected');
});

mongoose.connection.on('connected', function () {
    console.log('Mongoose default connection open to ' + dbURI);
});

process.on('SIGINT', function() {
    mongoose.connection.close(function () {
        console.log('Mongoose disconnected on app termination');
        process.exit(0);
    });
});

mongoose.connect(dbURI, { server: { socketOptions: { keepAlive: 1 } } });

exports.Trending = mongoose.model('Trending', trendingSchema);
exports.Explore = mongoose.model('Explore', exploreSchema);

