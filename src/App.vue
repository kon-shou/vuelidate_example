<template>
  <nav class="steps-nav">
    <button
      v-for="(step, i) in stepsList"
      :key="step.id"
      class="steps-nav__item"
      :data-active-step="step.id === curStep.id"
      :data-error-step="!!step.invalid"
      @click="setStep(i)"
    >
      {{ step.label }} {{ step.invalid ? `❌ ${step.errorCount}` : "✅" }}
    </button>
  </nav>

  <form @submit.prevent="onSubmit">
    <!-- BASE -->
    <section v-if="curStep.id === 'base'">
      <BaseInput
        v-model="v$.name.$model"
        label="Name"
        :error="v$.name.$errors[0]?.$message"
      />

      <BaseInput
        v-model="v$.emailAddress.$model"
        label="Email address"
        :error="v$.emailAddress.$errors[0]?.$message"
        @blur="v$.emailAddress.$commit"
      />
    </section>

    <!-- COLLECTION STEP -->
    <section v-if="curStep.id === 'collection'">
      <template
        v-if="!Object.keys(v$.collection.$model).length && isCollectionDirty"
      >
        <div class="error">This collection thing is required</div>
      </template>

      <fieldset v-for="(item, index) in v$.collection.$model" :key="index">
        <legend>
          Collection Item {{ index }}
          <button type="button" @click="removeItem(index)">x</button>
        </legend>

        <BaseInput
          label="Collection Item name"
          type="text"
          v-model="v$.collection[index].name.$model"
          :error="v$.collection[index].name.$errors[0]?.$message"
        />
        <BaseInput
          label="Collection Item Worth"
          type="text"
          v-model="v$.collection[index].worth.$model"
          :error="v$.collection[index].worth.$errors[0]?.$message"
        />
      </fieldset>
      <button type="button" @click="addItem">Add item</button>
    </section>

    <!-- external STEP -->
    <section v-if="curStep.id === 'external'">
      <BaseInput
        v-model="v$.yearsExp.$model"
        label="Experience"
        :error="v$.yearsExp.$errors[0]?.$message"
        @blur="v$.yearsExp.$commit"
      />
    </section>

    <!-- GLOBAL STATE -->
    <div>Steps have errors: {{ isSomeStepInvalid }}</div>

    <!-- PREV/NEX NAV -->
    <nav class="steps-nav">
      <button type="button" v-if="prevStep" @click="gotoPrevStep">
        PreviousStep
      </button>
      <button type="button" v-if="nextStep" @click="gotoNextStep">
        NextStep
      </button>
      |
      <button>
        {{ isSubmitting ? "Submitting..." : "Submit" }}
      </button>
    </nav>
  </form>

  <div style="display: flex">
    <div>
      <pre>{{ v$ }}</pre>
    </div>
  </div>
</template>

<script>
import { useVuelidate } from "@vuelidate/core";
import {
  required,
  email,
  minLength,
  requiredIf,
  helpers,
} from "@vuelidate/validators";
import { ValidateEach } from "@vuelidate/components";
import { reactive, computed, ref, watch, onMounted, nextTick } from "vue";
import { useSteps } from "./composables/useSteps.js";
import BaseInput from "./components/BaseInput.vue";

function postToFakeApi() {
  return new Promise((_r, reject) => {
    setTimeout(() => {
      // we need to update the api to ensure that errors are map accordint to each field
      // keys. Note that the backend should not have any knowledge of how we slip the form
      // the frontend, that's a presentation layer on top of a just a giant form.
      reject({
        yearsExp: [
          "We trick you, there is no amount of experience enough to submit this form",
        ],
      });
    }, 500);
  });
}

// TODO ASYNC VALIDATOR FOR FIELDS are not intuitive with vuelidate

function CollectionItemModel({ name = "", worth = "0" } = {}) {
  return { name, worth };
}

export default {
  name: "App",
  components: {
    BaseInput,
  },
  setup() {
    const state = reactive({
      name: "",
      emailAddress: "",
      yearsExp: "",
      collection: {},
    });

    const collectionDefs = computed(() =>
      Object.keys(state.collection).reduce(
        (acc, key) => {
          acc.rules[key] = {
            name: { required },
            worth: { required },
          };

          acc.paths.push(`collection.${key}.name`);
          acc.paths.push(`collection.${key}.worth`);

          return acc;
        },
        {
          rules: {},
          paths: [],
        }
      )
    );
    const rules = computed(() => {
      return {
        name: { required },
        emailAddress: {
          required,
          email,
        },
        yearsExp: { required },
        collection: {
          // required, don't do it, it will break validations,
          // maybe use a hidden field or some sort of hack
          ...collectionDefs.value.rules,
        },
        $validationGroups: {
          base: ["name", "emailAddress"],
          collection: collectionDefs.value.paths,
          external: ["yearsExp"],
        },
      };
    });

    const steps = reactive({
      base: {
        id: "base",
        label: "Base step",
        invalid: false,
        errorCount: 0,
      },
      collection: {
        id: "collection",
        label: "Collection step",
        invalid: false,
        errorCount: 0,
      },
      external: {
        id: "external",
        label: "external validated step",
        invalid: false,
        errorCount: 0,
      },
    });

    const $externalResults = ref({});
    const v$ = useVuelidate(rules, state, { $externalResults, $lazy: true });

    // since "collection" is just a holder for nested fields, and adding required
    // to it breaks we need hand rol a dirty flag
    let isCollectionDirty = ref(false);
    // if a collections starts empty without a placeholder model
    // $dirty doesn't work because we can't validate the collect itself only its fields
    // adding  required to the collection object breaks other validations
    const unwatch = watch(
      () => state.collection,
      () => {
        isCollectionDirty.value = true;
        unwatch();
      }
    );

    // VALIDATION GROUPS WATCHER FOR STEPS ERRORS
    watch(
      () => v$.value.$validationGroups,
      (newVal) => {
        console.log("groups", newVal, v$.value);

        Object.keys(newVal).forEach((key) => {
          const poorMansCollectionRequired =
            key === "collection" && Object.keys(state.collection).length === 0;
          console.log({ poorMansCollectionRequired });

          steps[key].invalid =
            newVal[key].$error ||
            (poorMansCollectionRequired && isCollectionDirty.value);
          steps[key].errorCount =
            poorMansCollectionRequired && isCollectionDirty.value
              ? 1
              : newVal[key].$errors.length;
        });
      },
      { immediate: true, deep: true }
    );

    // Collection methods
    async function addItem() {
      const id = Number(Object.keys(state.collection).at(-1) ?? -1) + 1;
      v$.value.collection.$model = {
        ...v$.value.collection.$model,
        [id]: CollectionItemModel(),
      };
    }

    async function removeItem(i) {
      // another vuelidate bug, if you don't reset errors when removing an object that
      // has an active error they will stay there when you create a new item at the same
      // position (id) because $errors is not completely removed. alternative is to generate
      // always a unique id for fields and add property with its index, which we need to
      // do anyways if order is important for or collection.
      await v$.value.collection[i].$reset();

      // USE IMMUTABLE METHODS OR YOU're going to have a bad time
      // state.collection = state.collection.filter((_, idx) => idx !== i);
      delete v$.value.collection.$model[i];
    }

    // SUBMIT
    const {
      stepsList,
      setStep,
      nextStep,
      prevStep,
      gotoPrevStep,
      gotoNextStep,
      curStep,
      isSomeStepInvalid,
      gotoToFirstStepWithErrors,
    } = useSteps(steps);

    const isSubmitting = ref(false);
    async function onSubmit() {
      isCollectionDirty.value = false;
      console.log("onSubmit");
      // v$.value?.$clearExternalResults?.();

      if (!(await v$.value.$validate())) {
        // we are already onx an invalid step don't navigate away
        if (curStep.value.invalid) return;
        // gotoToFirstStepWithErrors();
        return;
      }

      console.log(state);
      try {
        isSubmitting.value = true;
        await postToFakeApi();
      } catch (e) {
        console.log("error");
        $externalResults.value = e;
        gotoToFirstStepWithErrors();
      } finally {
        isSubmitting.value = false;
      }
    }

    return {
      rules,
      state,
      v$,
      curStep,
      steps,
      stepsList,
      setStep,
      nextStep,
      prevStep,
      gotoPrevStep,
      gotoNextStep,
      onSubmit,
      isSubmitting,
      isSomeStepInvalid,
      addItem,
      removeItem,
      isCollectionDirty,
    };
  },
};
</script>

<style lang="scss">
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
  margin-top: 60px;
}

.steps-nav {
  display: inline-flex;
  padding: 8px;
  background: grey;
  gap: 8px;
  border-radius: 8px;
}

.steps-nav__item {
  background: grainsboro;
  border: 0;
  border-radius: 4px;
  padding: 4px;

  &[data-active-step="true"] {
    background: goldenrod;
    color: black;
    outline: 2px solid goldenrod;
    outline-offset: 2px;
  }

  &[data-error-step="true"] {
    background: tomato;
    color: black;
  }
}

pre {
  background: black;
  color: lightgray;
  margin: 8px;
}

.error {
  color: tomato;
}
</style>
