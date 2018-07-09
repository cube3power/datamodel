import { FieldType, getUniqueId } from 'picasso-util';

const fieldStore = {
    data: {},

    /**
     * Adds a new data to the fieldStore and returns the data.
     *
     * @todo This function needs to write freshly.
     *
     * @param  {Array} fieldArr the list of field that will be present in this data
     * @param  {string} name name of the field store
     * @return {Object}          the data as a object which is added
     */
    createNameSpace(fieldArr, name) {
        const dataId = name || getUniqueId();
        this.data[dataId] = {
            name: dataId,
            fields: fieldArr,
            fieldsObj() {
                const retObj = {};
                this.fields.forEach((field) => {
                    retObj[field.name] = field;
                });
                return retObj;
            },
            getMeasure() {
                const retObj = {};
                this.fields.forEach((field) => {
                    if (field.schema.type === FieldType.MEASURE) {
                        retObj[field.name] = field;
                    }
                });
                return retObj;
            },
            getDimension() {
                const retObj = {};
                this.fields.forEach((field) => {
                    if (field.schema.type === FieldType.DIMENSION) {
                        retObj[field.name] = field;
                    }
                });
                return retObj;
            },
        };
        return this.data[dataId];
    },
};

export default fieldStore;
