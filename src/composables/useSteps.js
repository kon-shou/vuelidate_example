import { computed, ref, nextTick } from "vue";

export function useSteps(steps) {
  const stepsList = computed(() => Object.values(steps));

  const curStepIndex = ref(0);
  const curStep = computed(() => stepsList.value[curStepIndex.value]);
  const prevStep = computed(() => stepsList.value[curStepIndex.value - 1]);
  const nextStep = computed(() => stepsList.value[curStepIndex.value + 1]);

  function setStep(index) {
    if (index >= 0 && index <= stepsList.value.length - 1)
      curStepIndex.value = index;
  }

  function gotoPrevStep() {
    return setStep(curStepIndex.value - 1);
  }

  function gotoNextStep() {
    return setStep(curStepIndex.value + 1);
  }

  // this logic can be as simple or as complex as we want.
  // we can:
  // 1. find the first step with errors and go there
  // 1. decide to give priority to some step and mover there instead
  // 1. If the steps from which user submitted already has errors,
  //    don't go anywhere and stay there.

  async function gotoToFirstStepWithErrors() {
    await nextTick(); // sometimes the stepsmap is not yet updated when this fn runs, so we need nextTick to do the find.
    const pos = Object.keys(steps).findIndex(
      (step) => steps[step].invalid === true
    );

    if (pos !== -1) {
      console.log("gogotFirst", pos);
      return setStep(pos);
    }
  }

  const isSomeStepInvalid = computed(() =>
    stepsList.value.some((step) => step.invalid)
  );

  return {
    stepsList,
    curStep,
    prevStep,
    nextStep,
    setStep,
    gotoPrevStep,
    gotoNextStep,
    gotoToFirstStepWithErrors,
    isSomeStepInvalid
  };
}
