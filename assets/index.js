// @ts-check

const todoTemplate = /** @type {HTMLTemplateElement} */ (
  document.getElementById("todo-template")
);
const todoFormTemplate = /** @type {HTMLTemplateElement} */ (
  document.getElementById("todo-form-template")
);
const todoEditFormTemplate = /** @type {HTMLTemplateElement} */ (
  document.getElementById("todo-edit-form-template")
);

const DOUBLE_CLICK_DELAY = 200; // milliseconds

window.addEventListener("load", async () => {
  let todos;
  try {
    const response = await fetch("/todos");
    todos = await response.json();
  } catch (e) {
    console.error("Failed to create Todo item: ", e);
    return;
  }

  const todo_container = document.getElementById("all-todos");
  for (const todo of todos) {
    const todoElement = createTodoTree(
      todo.id,
      todo.description,
      todo.completed,
      todo.children,
    );

    todo_container?.appendChild(todoElement);
  }
  adjustLineHeights();
});

/** Places the form immediately after the refNode
 * @param {HTMLElement} refNode
 */
function newTodoForm(refNode) {
  let parentId = "";
  if (refNode.id != "dummy-first-todo") {
    const parIdElement = refNode.querySelector("input[name='id']");
    if (!(parIdElement instanceof HTMLInputElement)) {
      throw "element was not an input element";
    }
    parentId = parIdElement.value;
  }

  const template = /** @type {DocumentFragment}*/ (
    todoFormTemplate.content.cloneNode(true)
  );
  const parentIdElement = /** @type {HTMLInputElement | null} */ (
    template.querySelector("input[name='parent_id']")
  );
  if (!parentIdElement) {
    throw "no parent id element in template";
  }
  parentIdElement.value = parentId;

  refNode.after(template);
  const descriptionInput = refNode.nextElementSibling?.querySelector(
    "[name='description']",
  );
  if (!(descriptionInput instanceof HTMLInputElement)) {
    throw "no description element";
  }

  descriptionInput.focus(); // Focus for immediate typing
}

/**
 * @param {HTMLElement} formElement
 */
function removeTodoForm(formElement) {
  formElement.remove();
  adjustLineHeights();
}

/**
 * @param {number} id
 * @param {string} todoDescription
 * @param {boolean} todoCompleted
 * @returns {DocumentFragment}
 */
function createTodoElement(id, todoDescription, todoCompleted) {
  const newTodo = /** @type {DocumentFragment} */ (
    todoTemplate?.content.cloneNode(true)
  );

  const description = newTodo.querySelector(".todo-description");
  if (!description) {
    throw "description element not here";
  }
  description.innerHTML = markdownLinksToHtml(todoDescription);

  /** @type {HTMLInputElement | null}*/
  const idInput = newTodo.querySelector("input[name='id']");
  if (!idInput) {
    throw "id input not here";
  }
  idInput.value = id + "";

  /** @type {HTMLInputElement | null}*/
  const checkboxElement = newTodo.querySelector(".todo-checkbox");
  if (!checkboxElement) {
    throw "checkbox element not here";
  }
  checkboxElement.checked = todoCompleted;

  const content = newTodo.querySelector(".todo-contents");
  if (!content) {
    throw "Failed to get todo-contents";
  }

  let clickTimer = null;
  content.addEventListener("click", (event) => {
    if (!(event.target instanceof HTMLElement)) {
      return;
    }

    const clickedTagName = event.target.tagName.toLowerCase();
    if (clickedTagName === "a" || clickedTagName === "input") {
      return; // We want to still allow clicking anchor tags and clicking checkbox
    }

    if (clickTimer != null) {
      // This was a double click
      clearTimeout(clickTimer);
      clickTimer = null;

      console.log("Double Click");
      const closestTodo = event.target.closest(".todo-item");
      if (!closestTodo) {
        throw "Failed to get closest todo";
      }
      const todoParentNode = closestTodo.parentNode;
      if (!(todoParentNode instanceof HTMLElement)) {
        throw "todo parent node was not HTML Element";
      }
      newTodoForm(todoParentNode); // On double click we create a new todo
      return;
    }

    clickTimer = setTimeout(() => {
      // Single click
      clickTimer = null;

      console.log("Single Click");
      if (!(event.target instanceof HTMLElement)) {
        return;
      }
      const closestTodoItem = event.target.closest(".todo-item");
      if (!(closestTodoItem instanceof HTMLElement)) {
        throw "no closest item";
      }
      newEditTodoForm(closestTodoItem); // On single click we edit the current todo
    }, DOUBLE_CLICK_DELAY);
  });

  return newTodo;
}

/**
 * @param {number} id
 * @param {string} todoDescription
 * @param {boolean} todoCompleted
 * @param {Array<Object>} childTodos
 *
 * @returns {HTMLElement}
 */
function createTodoTree(id, todoDescription, todoCompleted, childTodos) {
  const todoTreeRoot = document.createElement("ul");

  const listItem = document.createElement("li");
  const newTodo = createTodoElement(id, todoDescription, todoCompleted);
  listItem.appendChild(newTodo);
  todoTreeRoot.appendChild(listItem);

  for (const child of childTodos) {
    todoTreeRoot.appendChild(
      createTodoTree(
        child.id,
        child.description,
        child.completed,
        child.children,
      ),
    );
  }

  return todoTreeRoot;
}

/**
 * @param {Event} event
 */
async function createTodo(event) {
  event.preventDefault();

  const submittedForm = event.target;
  if (!(submittedForm instanceof HTMLFormElement)) {
    throw "submitted form was not a form element";
  }

  const parentIdElement = submittedForm.querySelector(
    "input[name='parent_id']",
  );
  if (!(parentIdElement instanceof HTMLInputElement)) {
    throw "failed to get parent id";
  }

  /** @type {number|undefined} */
  let parentId = parseInt(parentIdElement.value);
  parentId = isNaN(parentId) ? undefined : parentId; // If the value is empty then set it to undefined

  const descriptionElement = submittedForm.querySelector(
    ".todo-description-input",
  );
  if (!(descriptionElement instanceof HTMLInputElement)) {
    throw "failed to get description input";
  }
  const todoDescription = descriptionElement.value;

  let newTodoId = undefined;
  try {
    const response = await fetch("/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: todoDescription,
        parentId: parentId,
      }),
    });

    const json_resp = await response.json();
    newTodoId = json_resp.id;
    console.log("Created new Todo with ID: ", newTodoId);
  } catch (e) {
    console.error("Failed to create Todo item: ", e);
    return;
  }

  const newTodo = createTodoTree(newTodoId, todoDescription, false, []);
  const closestTodoForm = submittedForm.closest(".todo-form");
  if (!(closestTodoForm instanceof HTMLElement)) {
    throw "failed to get closest todo form";
  }
  closestTodoForm.replaceWith(newTodo);

  adjustLineHeights();
}

/**
 * @param {HTMLElement} parentTodo
 * @returns {NodeListOf<HTMLElement>}
 */
function getChildrenTodoItems(parentTodo) {
  const parentUL = parentTodo.parentElement?.parentElement; // The todo item is in a li, which must also be in a ul
  if (!parentUL) {
    throw "parentTodo not inside a UL?";
  }

  return parentUL.querySelectorAll(".todo-item");
}

/**
 * @param {HTMLElement} todoElement
 * @returns {Element[]}
 */
function getSiblingTodos(todoElement) {
  const siblingTodos =
    todoElement.parentElement?.parentElement?.parentElement?.children; // The todo item is in a li, which must also be in a ul
  if (!siblingTodos) {
    throw "failed to get sibling todos";
  }

  const ret = Array.from(siblingTodos);
  ret.shift(); // Remove the first element because it is actually the parent of these todos.
  return ret;
}

/**
 * @param {HTMLElement} parentTodo
 */
async function toggleTodoItemRecursively(parentTodo) {
  const todoCheckbox = parentTodo.querySelector(".todo-checkbox");
  if (!(todoCheckbox instanceof HTMLInputElement)) {
    throw "todo checkbox not found";
  }
  const checked = todoCheckbox.checked;
  const childTodos = getChildrenTodoItems(parentTodo);

  const todoToUpdate = [];
  for (const child of childTodos) {
    const idElement = child.querySelector("input[name='id']");
    if (!(idElement instanceof HTMLInputElement)) {
      throw "id element is not input";
    }

    todoToUpdate.push({
      id: parseInt(idElement.value),
      completed: checked,
    });
  }

  try {
    const response = await fetch("/todos/completed", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(todoToUpdate),
    });
    if (!response.ok) {
      throw `server responded ${response.status}: ${response.statusText}`;
    }
    console.log("Updated todos with", todoToUpdate);
  } catch (e) {
    console.error("Failed to update Todo items: ", e);
    return;
  }

  for (const child of childTodos) {
    const checkBoxElement = child.querySelector(".todo-checkbox");
    if (!(checkBoxElement instanceof HTMLInputElement)) {
      throw "checkbox element is not input";
    }
    checkBoxElement.checked = checked;
  }

  if (checked) {
    // Move to the bottom if we just checked it
    animateTodoCheck(parentTodo, "bottom");
  } else {
    // Move to the top if we just unchecked it
    animateTodoCheck(parentTodo, "top");
  }
}

/**
 * @param {HTMLElement} todoElement
 * @param {"top" | "bottom"} newPosition
 */
function animateTodoCheck(todoElement, newPosition) {
  //TODO: Make the animation put the todos in the right spot not just top and bottom
  const siblingTodos = getSiblingTodos(todoElement);
  const pickedTodoUL = todoElement.closest("ul");
  if (!pickedTodoUL) {
    throw "failed to get picked todo";
  }

  const parentUL = pickedTodoUL.parentElement;
  if (!parentUL) {
    throw "failed to get parent UL";
  }

  // Step 1: record first positions
  const firstRecs = new Map();
  siblingTodos.forEach((el) => {
    firstRecs.set(el, el.getBoundingClientRect());
  });

  // Step 2: move the picked todo UL
  let movingElementLI = null;
  if (newPosition == "top") {
    if (pickedTodoUL === siblingTodos[0]) {
      // We are already at the top so no animation needed
      return;
    }

    const liElement = parentUL.firstElementChild; // The first element of the list is actually the parent todo text in a LI
    if (!(liElement instanceof HTMLElement)) {
      throw "first element does not exist";
    }
    parentUL.insertBefore(pickedTodoUL, liElement?.nextElementSibling);
  } else {
    if (pickedTodoUL === siblingTodos[siblingTodos.length - 1]) {
      // We are already at the bottom so no animation needed
      return;
    }
    for (const sibUL of siblingTodos) {
      if (sibUL !== pickedTodoUL) {
        movingElementLI = sibUL.firstElementChild;
        break;
      }
    }
    parentUL.appendChild(pickedTodoUL);
  }

  // Step 3: apply inverted transforms
  siblingTodos.forEach((el) => {
    if (!(el instanceof HTMLElement)) throw "list item is not an HTMLElement";

    const lastRect = el.getBoundingClientRect();
    const firstRect = firstRecs.get(el);
    const dx = firstRect.left - lastRect.left;
    const dy = firstRect.top - lastRect.top;

    el.style.transform = `translate(${dx}px, ${dy}px)`;
    el.style.transition = "transform 0s"; // no animation yet
  });

  // Step 4: remove the tree line for the current picked element
  const innerPickedTodoLI = pickedTodoUL.firstElementChild;
  if (!(innerPickedTodoLI instanceof HTMLElement)) {
    throw "pickedTodoLI not a HTMLElement";
  }
  innerPickedTodoLI.style.setProperty("--display", "none");
  if (movingElementLI && movingElementLI instanceof HTMLElement) {
    // We also want to make the first first moving remove its line too so it doesn't go above the checkbox
    movingElementLI.style.setProperty("--display", "none");
  }

  // Step 5: animate to final positions and wait for completion
  /**
   * Animate sibling todos and resolve when finished.
   * @param {HTMLElement[]} siblings - The elements to animate
   * @param {number} [duration=300] - Animation duration in ms
   * @returns {Promise<void>} Resolves when all animations are finished
   */
  function animateSiblings(siblings, duration = 300) {
    return new Promise((resolve) => {
      let remaining = siblings.length;
      if (remaining === 0) {
        resolve();
        return;
      }

      /**
       * @param {any} event
       */
      function onTransitionEnd(event) {
        if (event.propertyName !== "transform") return;

        event.target.removeEventListener("transitionend", onTransitionEnd);
        remaining--;

        if (remaining === 0) {
          resolve();
        }
      }

      siblings.forEach((el) => {
        el.addEventListener("transitionend", onTransitionEnd);

        // trigger animation in next frame
        requestAnimationFrame(() => {
          el.style.transition = `transform ${duration}ms ease`;
          el.style.transform = "none";
        });
      });

      // fallback in case transitionend doesn't fire (e.g., zero movement)
      setTimeout(() => {
        if (remaining > 0) resolve();
      }, duration + 50);
    });
  }

  // Step 5: run animation and adjust line heights after all finished
  animateSiblings(/**@type {HTMLElement[]}*/ (siblingTodos)).then(() => {
    innerPickedTodoLI.style.setProperty("--display", "block");
    if (movingElementLI && movingElementLI instanceof HTMLElement) {
      // We also want to add back the moved element line
      movingElementLI.style.setProperty("--display", "block");
    }
    adjustLineHeights();
  });
}
/**
 * @param {HTMLElement} todoElement
 */
function newEditTodoForm(todoElement) {
  const editForm = /** @type {DocumentFragment} */ (
    todoEditFormTemplate?.content.cloneNode(true)
  );

  const idElement = todoElement.querySelector("input[name='id']");
  if (!(idElement instanceof HTMLInputElement)) {
    throw "failed to get input id element";
  }
  const todoID = idElement.value;

  const idInput = /** @type {HTMLInputElement | null}  */ (
    editForm.querySelector("input[name='id']")
  );
  if (!idInput) {
    throw "no id input element";
  }
  idInput.value = todoID;

  const todoDescription = htmlLinksToMarkdown(
    todoElement.querySelector(".todo-description")?.innerHTML,
  );
  const descriptionInput = /** @type {HTMLInputElement | null}  */ (
    editForm.querySelector("[name='description']")
  );
  if (!descriptionInput) {
    throw "no description input";
  }
  descriptionInput.value = todoDescription;

  const todoBbox = todoElement.getBoundingClientRect();
  const submitButtons = editForm.querySelector(".todo-edit-buttons");
  if (!submitButtons) {
    throw "no submit buttons found";
  }

  todoElement.replaceWith(editForm);

  // Set the size to match the old space that was taken up
  const buttonBbox = submitButtons.getBoundingClientRect();
  descriptionInput.style.width = todoBbox.width - buttonBbox.width + "px";
  descriptionInput.style.height = todoBbox.height + "px";

  // Focus the description input and move cursor to the end
  descriptionInput.focus();
  if (descriptionInput.setSelectionRange) {
    const length = descriptionInput.value.length;
    descriptionInput.setSelectionRange(length, length);
  }

  // Make the text area submit form on enter key
  const formElement = /** @type {HTMLFormElement} */ (
    descriptionInput.closest(".todo-item")
  );
  if (!formElement) {
    throw "no form element";
  }
  formElement.style.width = todoBbox.width + "";
  formElement.style.height = todoBbox.height + "";
  descriptionInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault(); // Stop new line from actually showing up in the text area
      formElement.requestSubmit();
    }
  });
}

/**
 * @param {Event} event
 */
async function editTodo(event) {
  event.preventDefault();

  const submittedForm = event.target;
  if (!(submittedForm instanceof HTMLFormElement)) {
    throw "form was not a form";
  }

  const descriptionElement = submittedForm.querySelector(
    "[name='description']",
  );
  if (!(descriptionElement instanceof HTMLTextAreaElement)) {
    throw "description was not an input";
  }
  const newDescription = descriptionElement.value;

  const idElement = submittedForm.querySelector("input[name='id']");
  if (!(idElement instanceof HTMLInputElement)) {
    throw "idElement was not input";
  }
  const todoID = parseInt(idElement.value);

  // Send to DB
  let todo_json;
  try {
    const response = await fetch("/todos/description", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: todoID, description: newDescription }),
    });
    if (!response.ok) {
      throw `server responded ${response.status}: ${response.statusText}`;
    }

    todo_json = await response.json();
    console.log(
      `Updated todo ${todo_json.id} with new description ${todo_json.description}`,
    );
  } catch (e) {
    console.error("Failed to update Todo description: ", e);
    return;
  }

  // Update DOM
  const newTodo = createTodoElement(
    todo_json.id,
    todo_json.description,
    todo_json.completed,
  );

  submittedForm.replaceWith(newTodo);

  adjustLineHeights();
}

/**
 * @param {HTMLElement} todoItem
 */
async function deleteTodo(todoItem) {
  if (!confirm("Are you sure?")) {
    return;
  }

  const idElement = todoItem.querySelector("input[name='id']");
  if (!(idElement instanceof HTMLInputElement)) {
    throw "id element not input element";
  }
  const todoID = parseInt(idElement.value);

  // Send to DB
  try {
    const response = await fetch("/todos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: todoID }),
    });
    if (!response.ok) {
      throw `server responded ${response.status}: ${response.statusText}`;
    }
    console.log(`Deleted todo ${todoID}`);
  } catch (e) {
    console.error("Failed to delete Todo: ", e);
    return;
  }

  // Update DOM
  const treeUL = todoItem.parentElement?.parentElement;
  if (!treeUL) {
    throw "no parent parent element of todo item";
  }

  treeUL.remove();

  adjustLineHeights();
}

function adjustLineHeights() {
  /** @type {NodeListOf<HTMLElement>} */
  const lis = document.querySelectorAll("ul ul li");

  for (const curr of lis) {
    const sibCheckbox =
      curr?.parentElement?.previousElementSibling?.querySelector(
        ".todo-checkbox",
      );
    if (sibCheckbox == null) {
      continue;
    }

    const currRect = curr
      ?.querySelector(".todo-checkbox")
      ?.getBoundingClientRect();

    if (!currRect) {
      continue;
    }
    const currY = currRect.top + currRect.height / 2;
    const currHeight = currRect.height;

    const sibRect = sibCheckbox.getBoundingClientRect();
    const sibY = sibRect.top + sibRect.height / 2;

    const lineHeight = currY - sibY;

    curr.style.setProperty("--line-height", `${lineHeight}px`);
    curr.style.setProperty(
      "--top-shift",
      `-${lineHeight - currHeight + currRect.height / 2 - 3}px`,
    );
  }
}

/**
 * @param {string} text
 * @return {string}
 */
function markdownLinksToHtml(text) {
  return text.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );
}

/**
 * @param {string | undefined} html
 * @return {string}
 */
function htmlLinksToMarkdown(html) {
  if (!html) {
    return "";
  }

  return html.replace(/<a\s+href="([^"]+)"[^>]*>(.*?)<\/a>/g, "[$2]($1)");
}
