import Joi from "joi";

export const uploadMediaVal = {
  body: Joi.object({
    title: Joi.string().trim(),
    description: Joi.string().trim(),
    collectionId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).messages({
      'string.pattern.base': 'Collection ID must be a valid MongoDB ObjectId'
    })
  })
};

export const updateMediaVal = {
  params: Joi.object({
    mediaId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required().messages({
      'string.pattern.base': 'Media ID must be a valid MongoDB ObjectId',
      'any.required': 'Media ID is required'
    })
  }),
  body: Joi.object({
    title: Joi.string().trim(),
    description: Joi.string().trim(),
    collectionId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).allow(null).messages({
      'string.pattern.base': 'Collection ID must be a valid MongoDB ObjectId'
    })
  })
};

export const getCollectionMediaVal = {
  params: Joi.object({
    collectionId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required().messages({
      'string.pattern.base': 'Collection ID must be a valid MongoDB ObjectId',
      'any.required': 'Collection ID is required'
    })
  })
}; 