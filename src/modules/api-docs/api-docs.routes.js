const express = require('express');
const swaggerUi = require('swagger-ui-express');
const router = express.Router(); // eslint-disable-line new-cap
const ApiDocsController = require('./api-docs.controller');

/**
 * @swagger
 * /api-docs/raw:
 *   get:
 *     description: Return the formatted api-docs
 *     tags:
 *       - api-docs
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: Json formatted api-docs.
 */
router.get('/api-docs/raw', ApiDocsController.getRaw);
router.use('/api-docs', swaggerUi.serve, swaggerUi.setup(ApiDocsController.getDocs()));

module.exports = router;
