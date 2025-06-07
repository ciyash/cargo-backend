// middlewares/withCompanyFilter.js
export const CompanyFilter = (Model) => {
  return (req, res, next) => {
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(401).json({ success: false, message: "Unauthorized: companyId missing" });
    }

    req.scopedModel = {
      find: (query = {}) => Model.find({ ...query, companyId }),
      findOne: (query = {}) => Model.findOne({ ...query, companyId }),
      findById: (id) => Model.findOne({ _id: id, companyId }),
      findByIdAndUpdate: (id, update, options = {}) =>
        Model.findOneAndUpdate({ _id: id, companyId }, update, options),
      create: (data) => Model.create({ ...data, companyId }),
      deleteById: (id) => Model.findOneAndDelete({ _id: id, companyId }),
    };

    next();
  };
};
