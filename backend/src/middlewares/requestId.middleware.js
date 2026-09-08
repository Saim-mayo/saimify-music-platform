const { randomUUID } = require('crypto');

const requestId = (req, res, next) => {
   const header = req.headers['x-request-id'];
   const requestId = typeof header === 'string' && header.trim() ? header.trim() : randomUUID();

   req.id = requestId;
   res.setHeader('x-request-id', requestId);

   next();
};

module.exports = requestId;
