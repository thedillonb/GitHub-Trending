var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var dbURI = process.env['DB_URL'];

mongoose.connection.on('error', function (err) {
    console.log(err);
});

mongoose.connection.on('disconnected', function () {
    console.log('Connection to MongoDB has been disconnected');
});

mongoose.connection.on('connected', function () {
    console.log('Mongoose default connection open to ' + dbURI);
});

mongoose.connect(dbURI, { server: { socketOptions: { keepAlive: 1 } } });

process.on('SIGINT', function() {
    mongoose.connection.close(function () {
        console.log('Mongoose disconnected on app termination');
        process.exit(0);
    });
});

var repositorySchema = new Schema({
	owner: String,
	name: String,
	stars: Number,
	forks: Number,
    avatarUrl: String,
	description: String,
    url: String
}, { 
    versionKey: false,
    _id: false,
    id: false
});

repositorySchema.options.toJSON = {
    transform: function(doc, ret, options) {
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
		daily: [repositorySchema],
		weekly: [repositorySchema],
		monthly: [repositorySchema]
	}
}, { versionKey: false });

trendingSchema.options.toJSON = {
    transform: function(doc, ret, options) {
        delete ret._id;
        return ret;
    }
};

trendingSchema.index({ 'language.slug': 1 });

var exploreSchema = new Schema({
	name: String,
	slug: String,
    image: String,
    description: String,
	repositories: [repositorySchema]
}, { versionKey: false });

exploreSchema.options.toJSON = {
    transform: function(doc, ret, options) {
        delete ret._id;
        return ret;
    }
};

exploreSchema.index({ slug: 1 });

exports.Trending = mongoose.model('Trending', trendingSchema);
exports.Explore = mongoose.model('Explore', exploreSchema);