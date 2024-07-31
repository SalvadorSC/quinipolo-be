const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  price: {
    type: String,
    required: true,
  },
  subscribers: {
    type: [String],
  },
});

const Products = mongoose.model("products", productSchema);

module.exports = Products;
