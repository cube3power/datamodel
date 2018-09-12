
/**
 * DataModel's opearators are exposed as composable functional operators as well as chainable operators. Chainable
 * operators are called on the instances of {@link Datamodel} class.
 *
 * Those same operators can be used as composable operators from `DataModel.Operators` namespace.
 *
 * The procedure of invoking all these operators is consistent. All these operators when called with the argument
 * returns a function which expects a DataModel instance.
 *
 * @public
 * @module Operators
 * @namespace DataModel
 */

/**
 * This is functional version of selection operator. Selection is a row filtering operation. It takes
 * {@link SelectionPredicate | predicate} for filtering criteria and returns a function. The returned function is called
 * with the DataModel instance on which the action needs to be performed.
 *
 * {@link SelectionPredicate} is a function which returns a boolean value. For selection opearation the selection
 * function is called for each row of DataModel instance with the current row passed as argument.
 *
 * After executing {@link SelectionPredicate} the rows are labeled as either an entry of selection set or an entry
 * of rejection set.
 *
 * {@link FilteringMode} operates on the selection and rejection set to determine which one would reflect in the
 * resulatant datamodel.
 *
 * @warning
 * Note
 * [Warn] Selection and rejection set is only a logical idea for concept explanation purpose.
 *
 * @error
 * Not all modes are valid
 * `FilteringMode.ALL` is not a valid working mode for functional version of `select`. Its only avialable on the chained
 * version.
 *
 * @example
 *  //@preamble_start
 *  Promise.all([loadData('/static/cars.json'), loadData('/static/cars-schema.json')]).then(function (params) {
 *  const data = params[0];
 *  const schema = params[1];
 *  const DataModel = muze.DataModel;
 *  const dm = new DataModel(data, schema);
 *  //@preamble_end
 *  // DataModel instance is created from https://www.charts.com/static/cars.json data,
 *  // https://www.charts.com/static/cars-schema.json schema and assigned to variable dm. DataModel is extracted from
 *  // muze namespace and assigned to the DataModel variable.
 *  const select = DataModel.Operators.select;
 *  usaCarsFn = select(fields => fields.Origin.value === 'USA');
 *  outputDM = usaCarsFn(dm);
 *  //@preamble_start
 *  printDM(outputDM);
 *  });
 *  //@preamble_end
 *
 * @public
 * @namespace DataModel
 * @segment Operators
 *
 * @param {SelectionPredicate} selectFn - Predicate function which is called for each row with the current row
 *      ```
 *          function (row, i)  { ... }
 *      ```
 * @param {Object} [config] - The configuration object to control the inclusion exclusion of a row in resultant
 *      DataModel instance
 * @param {FilteringMode} [config.mode=FilteringMode.NORMAL] - The mode of the selection
 *
 * @return {PreparatorFunction} Function which expects an instance of DataModel on which the operator needs to be
 *      applied.
 */
export const select = (...args) => dm => dm.select(...args);

/**
 * This is functional version of projection operator. Projection is a column (field) filtering operation. It expects
 * list of fields name and either include those or exclude those based on {@link FilteringMode} on the resultant
 * dataModel. It returns a function which is called with the DataModel instance on which the action needs to be
 * performed.
 *
 * Projection expects array of fields name based on which it creates the selection and rejection set. All the field
 * whose name is present in array goes in selection set and rest of the fields goes in rejection set.
 *
 * {@link FilteringMode} operates on the selection and rejection set to determine which one would reflect in the
 * resulatant datamodel.
 *
 * @warning
 * Note
 * Selection and rejection set is only a logical idea for concept explanation purpose.
 *
 * @error
 * Not all modes are valid
 * `FilteringMode.ALL` is not a valid working mode for functional version of `select`. Its only avialable on the
 * chained version.
 *
 * @example
 *  //@preamble_start
 *  Promise.all([loadData('/static/cars.json'), loadData('/static/cars-schema.json')]).then(function (params) {
 *  const data = params[0];
 *  const schema = params[1];
 *  const DataModel = muze.DataModel;
 *  const dm = new DataModel(data, schema);
 *  //@preamble_end
 *  // DataModel instance is created from https://www.charts.com/static/cars.json data,
 *  // https://www.charts.com/static/cars-schema.json schema and assigned to variable dm. DataModel is extracted from
 *  // muze namespace and assigned to the DataModel variable.
 *  const project = DataModel.Operators.project;
 *  usaCarsFn = project(['Name'], { mode: DataModel.FilteringMode.INVERSE });
 *  outputDM = usaCarsFn(dm);
 *  //@preamble_start
 *  printDM(outputDM);
 *  });
 *  //@preamble_end
 *
 * @public
 * @namespace DataModel
 * @segment Operators
 *
 * @param {Array.<string | Regexp>} projField - An array of column names in string or regular expression.
 * @param {Object} [config] - An optional config to control the creation of new DataModel
 * @param {FilteringMode} [config.mode=FilteringMode.NORMAL] - Mode of the projection
 *
 * @return {PreparatorFunction} Function which expects an instance of DataModel on which the operator needs to be
 *      applied.
 */
export const project = (...args) => dm => dm.project(...args);

/**
 * This is functional version of binnig operator. Binning happens on a measure field based on a binning configuration.
 * Binning in DataModel does not aggregate the number of rows present in DataModel instance after binning, it just adds
 * a new field with the binned value. Refer binning {@link example_of_binning | example} to have a intuition of what
 * binning is and the use case.
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
 *  const binFn = bin('horsepower', config);
 *  const binnedDm = binFn(dm);
 *
 * @text
 * When `binCount` is defined as part of binning configuration
 * @example
 *  // DataModel already prepared and assigned to dm vairable
 *  const config = { binCount: 5, name: 'binnedHP' }
 *  const binFn = bin('horsepower', config);
 *  const binnedDm = binFn(Dm);
 *
 * @text
 * When `binSize` is defined as part of binning configuration
 * @example
 *  // DataModel already prepared and assigned to dm vairable
 *  const config = { binSize: 200, name: 'binnedHorsepower' }
 *  const binnedDm = dataModel.bin('horsepower', config);
 *  const binnedDm = binFn(Dm);
 *
 * @todo Fix interaction of binning and then make it public
 * @private
 * @namespace DataModel
 * @module Operators
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
 * @return {PreparatorFunction} Function which expects an instance of DataModel on which the operator needs to be
 *      applied.
 */
export const bin = (...args) => dm => dm.bin(...args);

/**
 * This is functional version of `groupBy` operator. This operator groups the data using particular dimensions and by
 * reducing measures. It expects a list of dimensions using which it projects the datamodel and perform aggregations to
 * reduce the duplicate tuples. Refer {@link /muze/docs/datamodel-operators#groupby | this document} to know the
 * intuition behind groupBy.
 *
 * DataModel by default provides definition of few {@link reducer | Reducers}.
 * {@link ReducerStore | User defined reducers} can also be registered.
 *
 * @example
 *  //@preamble_start
 *  Promise.all([loadData('/static/cars.json'), loadData('/static/cars-schema.json')]).then(function (params) {
 *  const data = params[0];
 *  const schema = params[1];
 *  const DataModel = muze.DataModel;
 *  const dm = new DataModel(data, schema);
 *  //@preamble_end
 *  // DataModel instance is created from https://www.charts.com/static/cars.json data,
 *  // https://www.charts.com/static/cars-schema.json schema and assigned to variable dm. DataModel is extracted from
 *  // muze namespace and assigned to the DataModel variable.
 *
 *  const groupBy = DataModel.Operators.groupBy;
 *  const groupedFn = groupBy(['Year'], { horsepower: 'max' } );
 *  const outputDM = groupByFn(dm);
 *  //@preamble_start
 *  printDM(outputDM);
 *  });
 *  //@preamble_end
 *
 * @public
 * @namespace DataModel
 * @segment Operators
 *
 * @param {Array.<string>} fieldsArr Array containing the name of dimensions
 * @param {Object} [reducers={}] A map whose key is the variable name and value is the name of the reducer. If its
 *      not passed, or any variable is ommitted from the object, default aggregation function is used from the
 *      schema of the variable.
 *
 * @return {PreparatorFunction} Function which expects an instance of DataModel on which the operator needs to be
 *      applied.
 */
export const groupBy = (...args) => dm => dm.groupBy(...args);

/**
 * It enables you to create new operator by composing existing operators. The newly created operator is used like any
 * other operator. The operations provided will be executed in a serial manner ie. result of one operation will be the
 * input for the next operations (like pipe operator in unix).
 *
 * Compose has added benefits which chaining does not provide. Like, if there are group of operators are involved to
 * transform data, chaining would create so intermediate DataModel instances. If `compose` is used no intermediate
 * DataModels are created.
 *
 * Suported operators in compose are
 * - `select`
 * - `project`
 * - `groupBy`
 * - `bin`
 * - Any operator created using compose `compose`
 *
 * @example
 *  //@preamble_start
 *  Promise.all([loadData('/static/cars.json'), loadData('/static/cars-schema.json')]).then(function (params) {
 *  const data = params[0];
 *  const schema = params[1];
 *  const DataModel = muze.DataModel;
 *  const dm = new DataModel(data, schema);
 *  //@preamble_end
 *  // DataModel instance is created from https://www.charts.com/static/cars.json data,
 *  // https://www.charts.com/static/cars-schema.json schema and assigned to variable dm. DataModel is extracted from
 *  // muze namespace and assigned to the DataModel variable.
 *  const compose = DataModel.Operators.compose;
 *  const select = DataModel.Operators.select;
 *  const project = DataModel.Operators.project;
 *
 *  let lowCylCarsFromUSADM= compose(
 *      select(fields => fields.Origin.value === 'USA' && fields.Cylinders.value === '4' ),
 *      project(['Origin', 'Cylinders'], { mode: DataModel.FilteringMode.INVERSE })
 *  );
 *
 *  const outputDM = lowCylCarsFromUSADM(dm);
 *  //@preamble_start
 *  printDM(outputDM);
 *  });
 *  //@preamble_end
 *
 * @public
 * @namespace DataModel
 * @module Operators
 *
 * @param {Array.<Operators>} operators: An array of operation that will be applied on the
 * datatable.
 *
 * @return {PreparatorFunction} Function which expects an instance of DataModel on which the operator needs to be
 *      applied.
 */
export const compose = (...operations) =>
    (dm, config = { saveChild: true }) => {
        let currentDM = dm;
        let frstChild;
        const derivations = [];
        const saveChild = config.saveChild;

        operations.forEach((operation) => {
            currentDM = operation(currentDM);
            derivations.push(...currentDM._derivation);
            if (!frstChild) {
                frstChild = currentDM;
            }
        });

        saveChild && currentDM.addParent(dm, derivations);
        if (derivations.length > 1) {
            frstChild.dispose();
        }

        return currentDM;
    };
