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
    };