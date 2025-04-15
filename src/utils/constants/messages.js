const generateMessage = (entity) => ({
    alreadyExist: `${entity} already Exist`,
    notFound: `${entity} not found`,
    createSuccessfully: `${entity} created successfully`,
    loginSuccessfully: `${entity} logged in successfully`,
    getSuccessfully: `${entity} fetched successfully `,
    updateSuccessfully: `${entity} updated successfully`,
    deleteSuccessfully: `${entity} deleted successfully`,
    failToCreate: `fail to create ${entity}`,
    failToUpdate: `fail to Update ${entity}`,
    failToDelete: `fail to Delete ${entity}`,
    failToGet: `fail to get ${entity}`,
    notAuthorized: "not authorized to access this api",
  });
  
  export const messages = {
    user: {
      ...generateMessage("user"),
      verified: "user verified successfully",
      invalidCredentials: "invalid credentials",
      notAuthorized: "not authorized to access this api",
    },
    collection: {
      ...generateMessage("collection"),
    },
    media: {
      ...generateMessage("media"),
      fileRequired: "Please upload a file",
      filesRequired: "Please upload at least one file",
      uploadFailed: "Failed to upload file to cloud storage",
      uploadSuccess: "Media uploaded successfully",
      multipleUploadSuccess: "Media files uploaded successfully",
      failToSave: "Failed to save media information",
      deleteSuccess: "Media deleted successfully",
      notAuthorized: "You are not authorized to delete this media"
    }
  };