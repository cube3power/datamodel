/* eslint-disable default-case */

import { FieldType } from './enums';
import {
    persistDerivation,
    getRootGroupByModel,
    propagateToAllDataModels,
    getRootDataModel,
    propagateImmutableActions,
    addToPropNamespace
} from './helper';
import { DM_DERIVATIVES, PROPAGATION } from './constants';
import {
    dataBuilder,
    rowDiffsetIterator,
    groupBy
} from './operator';
import { createBinnedFieldData } from './operator/bucket-creator';
import Relation from './relation';
import reducerStore from './utils/reducer-store';
import createFields from './field-creator';

/**
 * DataModel is an in-browser representation of tabular data. It supports
 * {@link https://en.wikipedia.org/wiki/Relational_algebra | relational algebra} operators as well as generic data
 * processing opearators.
 * DataModel extends {@link Relation} class which defines all the relational algebra opreators. DataModel gives
 * definition of generic data processing operators which are not relational algebra complient.
 *
 * @public
 * @class
 * @extends Relation
 * @memberof Datamodel
 */
class DataModel extends Relation {
    /**
     * Creates a new DataModel instance by providing data and schema. Data could be in the form of
     * - Flat JSON
     * - DSV String
     * - 2D Array
     *
     * By default DataModel finds suitable adapter to serialize the data. DataModel also expects a
     * {@link Schema | schema} for identifying the variables present in data.
     *
     * @constructor
     * @example
     * const data = loadData('cars.csv');
     * const schema = [
     *      { name: 'Name', type: 'dimension' },
     *      { name: 'Miles_per_Gallon', type: 'measure', unit : 'cm', scale: '1000', numberformat: val => `${val}G`},
     *      { name: 'Cylinders', type: 'dimension' },
     *      { name: 'Displacement', type: 'measure' },
     *      { name: 'Horsepower', type: 'measure' },
     *      { name: 'Weight_in_lbs', type: 'measure' },
     *      { name: 'Acceleration', type: 'measure' },
     *      { name: 'Year', type: 'dimension', subtype: 'datetime', format: '%Y' },
     *      { name: 'Origin', type: 'dimension' }
     * ];
     * const dm = new DataModel(data, schema, { name: 'Cars' });
     * table(dm);
     *
     * @public
     *
     * @param {Array.<Object> | string | Array.<Array>} data Input data in any of the mentioned formats
     * @param {Array.<Schema>} schema Defination of the variables. Order of the variables in data and order of the
     *      variables in schema has to be same.
     * @param {object} [options] Optional arguments to specify more settings regarding the creation part
     * @param {string} [options.name] Name of the datamodel instance. If no name is given an auto generated name is
     *      assigned to the instance.
     * @param {string} [options.fieldSeparator=','] specify field separator type if the data is of type dsv string.
     */
    constructor (...args) {
        super(...args);

        this._onPropagation = [];
        this._sortingDetails = [];
    }

    /**
     * Reducers are simple functions which reduces an array of numbers to a representative number of the set.
     * Like an array of numbers `[10, 20, 5, 15]` can be reduced to `12.5` if average / mean reducer function is
     * applied. All the measure fields in datamodel (variables in data) needs a reducer to handle aggregation.
     *
     * @public
     *
     * @return {ReducerStore} Singleton instance of {@link ReducerStore}.
     */
    static get Reducers () {
        return reducerStore;
    }

    /**
     * Retrieve the data attached to an instance in JSON format.
     *
     * @example
     * // DataModel instance is already prepared and assigned to dm variable
     *  const data = dm.getData({
     *      order: 'column',
     *      formatter: {
     *          origin: (val) => val === 'European Union' ? 'EU' : val;
     *      }
     *  });
     *  console.log(data);
     *
     * @public
     *
     * @param {Object} [options] Options to control how the raw data is to be returned.
     * @param {string} [options.order='row'] Defines if data is retieved in row order or column order. Possible values
     *      are `'rows'` and `'columns'`
     * @param {Function} [options.formatter=null] Formats the output data. This expects an object, where the keys are
     *      the name of the variable needs to be formatted. The formatter function is called for each row passing the
     *      value of the cell for a particular row as arguments. The formatter is a function in the form of
     *      `function (value, rowId, schema) => { ... }`
     *      Know more about {@link Fomatter}.
     *
     * @return {Array} Returns a multidimensional array of the data with schema. The return format looks like
     *      ```
     *          {
     *              data,
     *              schema
     *          }
     *      ```
     */
    getData (options) {
        const defOptions = {
            order: 'row',
            formatter: null,
            withUid: false,
            getAllFields: false,
            sort: []
        };
        options = Object.assign({}, defOptions, options);
        const fields = this.getPartialFieldspace().fields;

        const dataGenerated = dataBuilder.call(
            this,
            this.getPartialFieldspace().fields,
            this._rowDiffset,
            options.getAllFields ? fields.map(d => d.name).join() : this._colIdentifier,
            options.sort,
            {
                columnWise: options.order === 'column',
                addUid: !!options.withUid
            }
        );

        if (!options.formatter) {
            return dataGenerated;
        }

        const { formatter } = options;
        const { data, schema, uids } = dataGenerated;
        const fieldNames = schema.map((e => e.name));
        const fmtFieldNames = Object.keys(formatter);
        const fmtFieldIdx = fmtFieldNames.reduce((acc, next) => {
            const idx = fieldNames.indexOf(next);
            if (idx !== -1) {
                acc.push([idx, formatter[next]]);
            }
            return acc;
        }, []);

        if (options.order === 'column') {
            fmtFieldIdx.forEach((elem) => {
                const fIdx = elem[0];
                const fmtFn = elem[1];

                data[fIdx].forEach((datum, datumIdx) => {
                    data[fIdx][datumIdx] = fmtFn.call(
                        undefined,
                        datum,
                        uids[datumIdx],
                        schema[fIdx]
                    );
                });
            });
        } else {
            data.forEach((datum, datumIdx) => {
                fmtFieldIdx.forEach((elem) => {
                    const fIdx = elem[0];
                    const fmtFn = elem[1];

                    datum[fIdx] = fmtFn.call(
                        undefined,
                        datum[fIdx],
                        uids[datumIdx],
                        schema[fIdx]
                    );
                });
            });
        }

        return dataGenerated;
    }

    /**
     * Groups the data using particular dimensions and by reducing measures. It expects a list of dimensions using which
     * it projects the datamodel and perform aggregations to reduce the duplicate tuples. Refer this
     * {@link link_to_one_example_with_group_by | document} to know the intuition behind groupBy.
     *
     * DataModel by default provides definition of few {@link reducer | Reducers}.
     * {@link ReducerStore | User defined reducers} can also be registered.
     *
     * This is the chained implementation of `groupBy`.
     * `groupBy` also supports {@link link_to_compose_groupBy | composability}
     *
     * @example
     * const groupedDM = dm.groupBy(['Year'], { horsepower: 'max' } );
     * console.log(groupedDm);
     *
     * @public
     *
     * @param {Array.<string>} fieldsArr - Array containing the name of dimensions
     * @param {Object} [reducers={}] - A map whose key is the variable name and value is the name of the reducer. If its
     *      not passed, or any variable is ommitted from the object, default aggregation function is used from the
     *      schema of the variable.
     *
     * @return {DataModel} Returns a new DataModel instance after performing the groupby.
     */
    groupBy (fieldsArr, reducers = {}, config = { saveChild: true }) {
        const groupByString = `${fieldsArr.join()}`;
        let params = [this, fieldsArr, reducers];
        const newDataModel = groupBy(...params);

        if (config.saveChild) {
            this._children.push(newDataModel);
            persistDerivation(
                newDataModel,
                DM_DERIVATIVES.GROUPBY,
                { fieldsArr, groupByString, defaultReducer: reducerStore.defaultReducer() },
                reducers
            );
        }

        newDataModel._parent = this;
        return newDataModel;
    }

    /**
     * Performs sorting operation on the current {@link DataModel} instance according to the specified sorting details.
     * Like every other operator it doesn't mutate the current DataModel instance on which it was called, instead
     * returns a new DataModel instance containing the sorted data.
     *
     * DataModel support multi level sorting by listing the variables using which sorting needs to be performed and
     * the type of sorting `ASC` or `DESC`.
     *
     * In the following example, data is sorted by `Origin` field in `DESC` order in first level followed by another
     * level of sorting by `Acceleration` in `ASC` order.
     *
     * @example
     * // here dm is the pre-declared DataModel instance containing the data of 'cars.json' file
     * let sortedDm = dm.sort([
     *    ["Origin", "DESC"]
     *    ["Acceleration"] // Default value is ASC
     * ]);
     *
     * console.log(dm.getData());
     * console.log(sortedDm.getData());
     *
     * // Sort with a custom sorting function
     * sortedDm = dm.sort([
     *    ["Origin", "DESC"]
     *    ["Acceleration", (a, b) => a - b] // Custom sorting function
     * ]);
     *
     * console.log(dm.getData());
     * console.log(sortedDm.getData());
     *
     * @text
     * DataModel also provides another sorting mechanism out of the box where sort is applied to a variable using
     * another variable which determines the order.
     * Like the above DataModel contains three fields `Origin`, `Name` and `Acceleration`. Now, the data in this
     * model can be sorted by `Origin` field according to the average value of all `Acceleration` for a
     * particular `Origin` value.
     *
     * @example
     * // here dm is the pre-declared DataModel instance containing the data of 'cars.json' file
     * const sortedDm = dm.sort([
     *     ['Origin', ['Acceleration', (a, b) => avg(...a.Acceleration) - avg(...b.Acceleration)]]
     * ]);
     *
     * console.log(dm.getData());
     * console.log(sortedDm.getData());
     *
     * @public
     *
     * @param {Array.<Array>} sortingDetails - Sorting details based on which the sorting will be performed.
     * @return {DataModel} Returns a new instance of DataModel with sorted data.
     */
    sort (sortingDetails) {
        const rawData = this.getData({
            order: 'row',
            sort: sortingDetails
        });
        const header = rawData.schema.map(field => field.name);
        const dataInCSVArr = [header].concat(rawData.data);

        const sortedDm = new this.constructor(dataInCSVArr, rawData.schema, { dataFormat: 'DSVArr' });
        sortedDm._sortingDetails = sortingDetails;
        return sortedDm;
    }

    addField (field) {
        const fieldName = field.fieldName();
        this._colIdentifier += `,${fieldName}`;
        const partialFieldspace = this._partialFieldspace;

        if (!partialFieldspace.fieldsObj()[field.fieldName()]) {
            partialFieldspace.fields.push(field);
        } else {
            const fieldIndex = partialFieldspace.fields.findIndex(fieldinst => fieldinst.name === fieldName);
            fieldIndex >= 0 && (partialFieldspace.fields[fieldIndex] = field);
        }

        this.__calculateFieldspace().calculateFieldsConfig();
        return this;
    }

     /**
     * Creates a new variable calculated from existing variable. This method expects the defination of the newly created
     * variable and a function which resolves the value of the new variable from existing variables.
     *
     * Can create a new measure based on existing variables
     * @example
     *  // DataModel already prepared and assigned to dm vairable;
     *  const newDm = dataModel.calculateVariable({
     *      name: 'powerToWeight',
     *      type: 'measure'
     *  }, ['horsepower', 'weight_in_lbs', (hp, weight) => hp / weight ]);
     *
     *
     * Can create a new dimension based on existing variables
     * @example
     *  // DataModel already prepared and assigned to dm vairable;
     *  const child = dataModel.calculateVariable(
     *     {
     *       name: 'Efficiency',
     *       type: 'dimension'
     *     }, ['horsepower', (hp) => {
     *      if (hp < 80) { return 'low'; },
     *      else if (hp < 120) { return 'moderate'; }
     *      else { return 'high' }
     *  }]);
     *
     * @public
     *
     * @param {Schema} schema: Schema of newly defined variable
     * @param {VariableResolver} resolver: Resolver format to resolve the current variable
     *
     * @return {DataModel} Instance of DataModel with the new field
     */
    calculateVariable (schema, dependency, config = { saveChild: true, replaceVar: false }) {
        const fieldsConfig = this.getFieldsConfig();
        const depVars = dependency.slice(0, dependency.length - 1);
        const retrieveFn = dependency[dependency.length - 1];

        if (fieldsConfig[schema.name] && !config.replaceVar) {
            throw new Error(`${schema.name} field already exists in model.`);
        }
        const depFieldIndices = depVars.map((field) => {
            const fieldSpec = fieldsConfig[field];
            if (!fieldSpec) {
                // @todo dont throw error here, use warning in production mode
                throw new Error(`${field} is not a valid column name.`);
            }
            return fieldSpec.index;
        });

        let clone = this.clone();

        const fs = clone.getFieldspace().fields;
        const suppliedFields = depFieldIndices.map(idx => fs[idx]);

        const computedValues = [];
        rowDiffsetIterator(clone._rowDiffset, (i) => {
            const fieldsData = suppliedFields.map(field => field.data[i]);
            computedValues[i] = retrieveFn(...fieldsData, i, fs);
        });
        const [field] = createFields([computedValues], [schema], [schema.name]);
        clone.addField(field);

        if (config.saveChild) {
            persistDerivation(clone, DM_DERIVATIVES.CAL_VAR, { config: schema, fields: depVars }, retrieveFn);
        }

        return clone;
    }

    /**
     * Propagates changes across all the connected DataModel instances.
     *
     * @param {Array} identifiers - A list of identifiers that were interacted with.
     * @param {Object} payload - The interaction specific details.
     *
     * @return {DataModel} DataModel instance.
     */
    propagate (identifiers, config = {}, addToNameSpace, propConfig = {}) {
        const isMutableAction = config.isMutableAction;
        const propagationSourceId = config.sourceId;
        const payload = config.payload;
        const rootModel = getRootDataModel(this);
        const propagationNameSpace = rootModel._propagationNameSpace;
        const rootGroupByModel = getRootGroupByModel(this);
        const rootModels = {
            groupByModel: rootGroupByModel,
            model: rootModel
        };

        addToNameSpace && addToPropNamespace(propagationNameSpace, config, this);
        propagateToAllDataModels(identifiers, rootModels, { propagationNameSpace, sourceId: propagationSourceId },
            Object.assign({
                payload
            }, config));

        if (isMutableAction) {
            propagateImmutableActions(propagationNameSpace, rootModels, {
                config,
                propConfig
            }, this);
        }

        return this;
    }

    /**
     * Associates a callback with an event name.
     *
     * @param {string} eventName - The name of the event.
     * @param {Function} callback - The callback to invoke.
     * @return {DataModel} Returns this current DataModel instance itself.
     */
    on (eventName, callback) {
        switch (eventName) {
        case PROPAGATION:
            this._onPropagation.push(callback);
            break;
        }
        return this;
    }

    /**
     * Unsubscribes the callbacks for the provided event name.
     *
     * @param {string} eventName - The name of the event to unsubscribe.
     * @return {DataModel} Returns the current DataModel instance itself.
     */
    unsubscribe (eventName) {
        switch (eventName) {
        case PROPAGATION:
            this._onPropagation = [];
            break;

        }
        return this;
    }

    /**
     * This method is used to invoke the method associated with propagation.
     *
     * @param {Object} payload The interaction payload.
     * @param {DataModel} identifiers The propagated DataModel.
     * @memberof DataModel
     */
    handlePropagation (propModel, payload) {
        let propListeners = this._onPropagation;
        propListeners.forEach(fn => fn.call(this, propModel, payload));
    }

    /**
     * Perfoms binning on a measure field based on a binning configuration. This method does not aggregate the number of
     * rows present in DataModel instance after binning, it just adds a new field with the binned value. Refer binning
     * {@link example_of_binning | example} to have a intuition of what binning is and the use case.
     *
     * Binning can be configured by
     * - providing custom bin configuration with non uniform buckets
     * - providing bin count
     * - providing each bin size
     *
     * When custom buckets are provided as part of binning configuration
     * @example
     *  // DataModel already prepared and assigned to dm vairable
     *  const buckets = {
     *      start: 30
     *      stops: [80, 100, 110]
     *  };
     *  const config = { buckets, name: 'binnedHP' }
     *  const binDM = dataModel.bin('horsepower', config);\
     *
     * @text
     * When `binCount` is defined as part of binning configuration
     * @example
     *  // DataModel already prepared and assigned to dm vairable
     *  const config = { binCount: 5, name: 'binnedHP' }
     *  const binDM = dataModel.bin('horsepower', config);
     *
     * @text
     * When `binSize` is defined as part of binning configuration
     * @example
     *  // DataModel already prepared and assigned to dm vairable
     *  const config = { binSize: 200, name: 'binnedHorsepower' }
     *  const binDM = dataModel.bin('horsepower', config);
     *
     * @public
     *
     * @param {String} name Name of measure which will be used to create bin
     * @param {Object} config Config required for bin creation
     * @param {Array.<Number>} config.bucketObj.stops Defination of bucket ranges. Two subsequent number from arrays
     *      are picked and a range is created. The first number from range is inclusive and the second number from range
     *      is exclusive.
     * @param {Number} [config.bucketObj.startAt] Force the start of the bin from a particular number.
     *      If not mentioned, the start of the bin or the lower domain of the data if stops is not mentioned, else its
     *      the first value of the stop.
     * @param {Number} config.binSize Bucket size for each bin
     * @param {Number} config.binCount Number of bins which will be created
     * @param {String} config.name Name of the new binned field to be created
     *
     * @returns {DataModel} Instance of new DataModel with the newly created bin.
     */
    bin (measureName, config = { }) {
        const clone = this.clone();
        const binFieldName = config.name || `${measureName}_binned`;
        if (this.getFieldsConfig()[binFieldName] || !this.getFieldsConfig()[measureName]) {
            throw new Error(`Field ${measureName} already exists.`);
        }
        const field = this._partialFieldspace.fields.find(currfield => currfield.name === measureName);
        const dataSet = createBinnedFieldData(field, this._rowDiffset, config);
        const binField = createFields([dataSet.data], [
            {
                name: binFieldName,
                type: FieldType.MEASURE,
                subtype: 'discrete', // @todo : DimensionSubtype
                bins: {
                    range: dataSet.range,
                    mid: dataSet.mid
                }
            }], [binFieldName])[0];
        clone.addField(binField);
        persistDerivation(clone, DM_DERIVATIVES.BIN, { measureName, config, binFieldName }, null);
        return clone;
    }
}

export default DataModel;
