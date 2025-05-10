import Joi from "joi";

/**
 * Validation schema for media upload operations
 * Supports both direct file uploads and URL-based uploads
 * For file uploads: Submit a file with field name 'file'
 * For URL uploads: Submit a 'mediaUrl' field in the request body
 * For multiple URL uploads: Submit a 'mediaUrls' array in the request body
 */
export const uploadMediaVal = {
  body: Joi.object({
    title: Joi.string().trim(),
    description: Joi.string().trim(),
    collectionId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).messages({
      'string.pattern.base': 'Collection ID must be a valid MongoDB ObjectId'
    }),
    skipAI: Joi.boolean().default(false),
    aiOptions: Joi.object({
      saveResults: Joi.boolean().default(true)
    }).default({}),
    // For single URL upload
    mediaUrl: Joi.string().uri().messages({
      'string.uri': 'Media URL must be a valid URL'
    }),
    // For multiple URL uploads
    mediaUrls: Joi.array().items(
      Joi.string().uri().required().messages({
        'string.uri': 'Each media URL must be a valid URL',
        'string.empty': 'Media URL cannot be empty'
      })
    )
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

export const assignCollectionVal = {
  params: Joi.object({
    mediaId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required().messages({
      'string.pattern.base': 'Media ID must be a valid MongoDB ObjectId',
      'any.required': 'Media ID is required'
    })
  }),
  body: Joi.object({
    collectionId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required().messages({
      'string.pattern.base': 'Collection ID must be a valid MongoDB ObjectId',
      'any.required': 'Collection ID is required'
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