// MODELS
const Pet = require('../models/pet');

// UPLOADING TO AWS S3
const multer  = require('multer');
const upload = multer({ dest: 'uploads/' });
const Upload = require('s3-uploader');

const client = new Upload(process.env.S3_BUCKET, {
  aws: {
    path: 'pets/avatar',
    region: process.env.S3_REGION,
    acl: 'public-read',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  },
  cleanup: {
    versions: true,
    original: true
  },
  versions: [
    {
      maxWidth: 400,
      aspect: '16:10',
      suffix: '-standard'
    },
    {
      maxWidth: 300,
      aspect: '1:1',
      suffix: '-square'
    }
  ]
});

// PET ROUTES
module.exports = (app) => {

  // INDEX PET => index.js

  // NEW PET
  app.get('/pets/new', (req, res) => {
    res.render('pets-new');
  });

  // CREATE PET
  app.post('/pets', upload.single('avatar'), (req, res) => {
    var pet = new Pet(req.body);

    if(req.file) {
      client.upload(req.file.path, {}, function(err, versions, meta) {
        if (err) return res.send(500).send({ err });

        const image = versions[0];

        const urlArray = image.url.split('-');
        urlArray.pop();
        pet.avatarUrl = urlArray.join('-');

        pet.save((err) => {
          if (err) return res.status(400).send({ err });
          res.send({ pet });
        });
      });
    } else {
      pet.save((err) => {
        if (err) return res.status(400).send({ err })
        res.send({ pet });
      });
    }
  });

  // SHOW PET
  app.get('/pets/:id', (req, res) => {
    Pet.findById(req.params.id).exec((err, pet) => {
      console.log(pet)
      res.render('pets-show', { pet: pet });
    });
  });

  // EDIT PET
  app.get('/pets/:id/edit', (req, res) => {
    Pet.findById(req.params.id).exec((err, pet) => {
      res.render('pets-edit', { pet: pet });
    });
  });

  // UPDATE PET
  app.put('/pets/:id', (req, res) => {
    Pet.findByIdAndUpdate(req.params.id, req.body)
      .then((pet) => {
        res.redirect(`/pets/${pet._id}`)
      })
      .catch((err) => {
        // Handle Errors
      });
  });

  // DELETE PET
  app.delete('/pets/:id', (req, res) => {
    Pet.findByIdAndRemove(req.params.id).exec((err, pet) => {
      return res.redirect('/')
    });
  });

  app.post('/pets/:id/purchase', (req, res) => {
    console.log(req.body);

    const stripe = require('stripe')(process.env.PRIVATE_STRIPE_API_KEY);
    const token = req.body.stripeToken;

    const petId =  req.body.petId || req.params.id;

    Pet.findById(petId).exec((err, pet) => {
      if(err) {
        console.log('Error: ' + err);
        return res.redirect(`/pets/${petId}`);
      }
      const charge = stripe.charges.create({
        amount: pet.price * 100,
        currency: 'usd',
        description: `Purchased ${pet.name}, ${pet.species}`,
        source: token,
      }).then(() => {
         res.redirect(`/pets/${req.params.id}`);
      })
      .catch(err => {
        console.log('Error: ' + err);
      })
    });
  });

  app.get('/search', (req, res) => {
    const term = new RegExp(req.query.term, 'i');

    const page = req.query.page || 1;
    Pet.paginate({
      $or: [
        { name: term },
        { species: term }
      ]
    }, { page })
    .then((results) => {
      res.render('pets-index', {
        pets: results.docs,
        pagesCount: results.pages,
        currentPage: page,
        term: req.query.term
      });
    });
  });
}
